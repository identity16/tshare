CREATE SCHEMA tshare;
REVOKE ALL ON SCHEMA tshare FROM PUBLIC;
CREATE TABLE tshare.schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE tshare.users(
 id uuid PRIMARY KEY, display_name text NOT NULL CHECK(char_length(display_name) BETWEEN 1 AND 100), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tshare.organizations(
 id uuid PRIMARY KEY, name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 200), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tshare.memberships(
 organization_id uuid NOT NULL REFERENCES tshare.organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES tshare.users(id), role text NOT NULL CHECK(role IN ('owner','member')),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id)
);
CREATE INDEX memberships_user ON tshare.memberships(user_id,organization_id);
CREATE TABLE tshare.workspaces(
 organization_id uuid NOT NULL REFERENCES tshare.organizations(id) ON DELETE CASCADE,
 id uuid NOT NULL, name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 200), PRIMARY KEY(organization_id,id)
);
CREATE TABLE tshare.artifacts(
 organization_id uuid NOT NULL, id uuid NOT NULL, workspace_id uuid NOT NULL,
 name text NOT NULL CHECK(name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$'),
 created_by uuid NOT NULL REFERENCES tshare.users(id), current_revision_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id), UNIQUE(organization_id,workspace_id,name),
 FOREIGN KEY(organization_id,workspace_id) REFERENCES tshare.workspaces(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE tshare.revisions(
 organization_id uuid NOT NULL, id uuid NOT NULL, artifact_id uuid NOT NULL,
 number integer NOT NULL CHECK(number>0), title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 200),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=2000),
 kind text NOT NULL CHECK(kind IN ('html','markdown','image','pdf','folder','file')),
 entry text NOT NULL, bytes bigint NOT NULL CHECK(bytes>=0), created_by uuid NOT NULL REFERENCES tshare.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,id),
 UNIQUE(organization_id,id,artifact_id), UNIQUE(organization_id,artifact_id,number),
 FOREIGN KEY(organization_id,artifact_id) REFERENCES tshare.artifacts(organization_id,id) ON DELETE CASCADE
);
ALTER TABLE tshare.artifacts ADD CONSTRAINT current_revision_belongs_to_artifact
 FOREIGN KEY(organization_id,current_revision_id,id) REFERENCES tshare.revisions(organization_id,id,artifact_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE tshare.outbox(
 organization_id uuid NOT NULL REFERENCES tshare.organizations(id) ON DELETE CASCADE,
 id uuid NOT NULL, artifact_id uuid, revision_id uuid, type text NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), CHECK(revision_id IS NULL OR artifact_id IS NOT NULL), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,artifact_id) REFERENCES tshare.artifacts(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,revision_id,artifact_id) REFERENCES tshare.revisions(organization_id,id,artifact_id) ON DELETE CASCADE
);
CREATE FUNCTION tshare.organization_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('tshare.organization_id',true),'')::uuid
$$;
CREATE FUNCTION tshare.user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('tshare.user_id',true),'')::uuid
$$;
-- These narrowly scoped membership lookups intentionally run as the migration
-- owner. The application role never owns tables or inherits the migration role.
-- The fixed search path and explicit table qualification prevent shadowing.
CREATE FUNCTION tshare.is_member(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM tshare.memberships m WHERE m.organization_id=target AND m.user_id=tshare.user_id() AND m.active)
$$;
CREATE FUNCTION tshare.is_owner(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT target=tshare.organization_id() AND EXISTS(SELECT 1 FROM tshare.memberships m WHERE m.organization_id=target AND m.user_id=tshare.user_id() AND m.active AND m.role='owner')
$$;
CREATE FUNCTION tshare.can_read(target uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT target=tshare.organization_id() AND tshare.is_member(target)
$$;
CREATE FUNCTION tshare.can_edit(target uuid,artifact uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT tshare.can_read(target) AND EXISTS(SELECT 1 FROM tshare.artifacts a WHERE a.organization_id=target AND a.id=artifact AND (a.created_by=tshare.user_id() OR tshare.is_owner(target)))
$$;
ALTER TABLE tshare.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY membership_read ON tshare.memberships FOR SELECT USING(user_id=tshare.user_id() OR tshare.can_read(organization_id));
CREATE POLICY membership_insert ON tshare.memberships FOR INSERT WITH CHECK(tshare.is_owner(organization_id));
CREATE POLICY membership_update ON tshare.memberships FOR UPDATE USING(tshare.is_owner(organization_id)) WITH CHECK(tshare.is_owner(organization_id));
CREATE POLICY membership_delete ON tshare.memberships FOR DELETE USING(tshare.is_owner(organization_id));
ALTER TABLE tshare.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_read ON tshare.users FOR SELECT USING(id=tshare.user_id() OR EXISTS(SELECT 1 FROM tshare.memberships m WHERE m.user_id=users.id AND m.organization_id=tshare.organization_id() AND m.active AND tshare.can_read(m.organization_id)));
ALTER TABLE tshare.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organization_read ON tshare.organizations FOR SELECT USING(tshare.is_member(id));
CREATE POLICY organization_update ON tshare.organizations FOR UPDATE USING(tshare.is_owner(id)) WITH CHECK(tshare.is_owner(id));
ALTER TABLE tshare.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_read ON tshare.workspaces FOR SELECT USING(tshare.can_read(organization_id));
CREATE POLICY workspace_insert ON tshare.workspaces FOR INSERT WITH CHECK(tshare.is_owner(organization_id));
CREATE POLICY workspace_update ON tshare.workspaces FOR UPDATE USING(tshare.is_owner(organization_id)) WITH CHECK(tshare.is_owner(organization_id));
CREATE POLICY workspace_delete ON tshare.workspaces FOR DELETE USING(tshare.is_owner(organization_id));
ALTER TABLE tshare.artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY artifact_read ON tshare.artifacts FOR SELECT USING(tshare.can_read(organization_id));
CREATE POLICY artifact_insert ON tshare.artifacts FOR INSERT WITH CHECK(tshare.can_read(organization_id) AND created_by=tshare.user_id());
CREATE POLICY artifact_update ON tshare.artifacts FOR UPDATE USING(tshare.can_read(organization_id) AND (created_by=tshare.user_id() OR tshare.is_owner(organization_id))) WITH CHECK(tshare.can_read(organization_id) AND (created_by=tshare.user_id() OR tshare.is_owner(organization_id)));
CREATE POLICY artifact_delete ON tshare.artifacts FOR DELETE USING(tshare.can_read(organization_id) AND (created_by=tshare.user_id() OR tshare.is_owner(organization_id)));
ALTER TABLE tshare.revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY revision_read ON tshare.revisions FOR SELECT USING(tshare.can_read(organization_id));
CREATE POLICY revision_insert ON tshare.revisions FOR INSERT WITH CHECK(tshare.can_edit(organization_id,artifact_id) AND created_by=tshare.user_id());
ALTER TABLE tshare.outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbox_read ON tshare.outbox FOR SELECT USING(tshare.can_read(organization_id));
CREATE POLICY outbox_insert ON tshare.outbox FOR INSERT WITH CHECK(tshare.can_read(organization_id));
ALTER TABLE tshare.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE tshare.artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE tshare.revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE tshare.outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA tshare FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tshare FROM PUBLIC;
INSERT INTO tshare.schema_migrations(version) VALUES(1);

CREATE FUNCTION tshare.protect_last_owner() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.role='owner' AND OLD.active AND (TG_OP='DELETE' OR NOT NEW.active OR NEW.role<>'owner' OR NEW.organization_id<>OLD.organization_id OR NEW.user_id<>OLD.user_id) THEN
  PERFORM 1 FROM tshare.organizations WHERE id=OLD.organization_id FOR UPDATE;
  IF FOUND AND NOT EXISTS(SELECT 1 FROM tshare.memberships WHERE organization_id=OLD.organization_id AND active AND role='owner' AND user_id<>OLD.user_id) THEN
   RAISE EXCEPTION 'An organization must retain an active owner.' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tshare.protect_last_owner() FROM PUBLIC;
CREATE TRIGGER keep_active_owner BEFORE UPDATE OR DELETE ON tshare.memberships FOR EACH ROW EXECUTE FUNCTION tshare.protect_last_owner();
