CREATE TABLE tshare.identities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES tshare.users(id),
 issuer text NOT NULL CHECK(length(issuer) BETWEEN 1 AND 2048), subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 255),
 email text NOT NULL UNIQUE CHECK(email=lower(btrim(email)) AND length(email) BETWEEN 3 AND 320),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(issuer,subject)
);
CREATE TABLE tshare.invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES tshare.organizations(id) ON DELETE CASCADE,
 email text NOT NULL CHECK(email=lower(btrim(email)) AND length(email) BETWEEN 3 AND 320),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 created_by uuid NOT NULL REFERENCES tshare.users(id), accepted_by uuid REFERENCES tshare.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 CHECK((status='accepted')=(accepted_by IS NOT NULL))
);
CREATE UNIQUE INDEX pending_invitation ON tshare.invitations(organization_id,email) WHERE status='pending';
CREATE INDEX invitations_email ON tshare.invitations(email);
CREATE TABLE tshare.sessions (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'), user_id uuid NOT NULL REFERENCES tshare.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days', revoked_at timestamptz
);
CREATE INDEX sessions_user ON tshare.sessions(user_id);
-- No runtime table grants or policies: only the scoped functions below can read
-- these tables. Owner bypass is deliberate for pre-membership identity handling.
ALTER TABLE tshare.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tshare.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tshare.sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tshare.identities,tshare.invitations,tshare.sessions FROM PUBLIC;

CREATE FUNCTION tshare.access_user(token text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;
BEGIN
 SELECT user_id INTO actor FROM tshare.sessions WHERE token_hash=token AND revoked_at IS NULL AND expires_at>now();
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 RETURN actor;
END $$;
CREATE FUNCTION tshare.access_owner(token text,org uuid) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=tshare.access_user(token); member_role text;
BEGIN
 SELECT role INTO member_role FROM tshare.memberships WHERE organization_id=org AND user_id=actor AND active;
 IF member_role IS NULL THEN RAISE EXCEPTION 'membership_required'; END IF;
 IF member_role<>'owner' THEN RAISE EXCEPTION 'owner_required'; END IF;
 RETURN actor;
END $$;
CREATE FUNCTION tshare.access_login(provider text,sub text,mail text,label text,token text,old_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; known_email text;
BEGIN
 IF provider IS NULL OR length(provider) NOT BETWEEN 1 AND 2048 OR sub IS NULL OR length(sub) NOT BETWEEN 1 AND 255 OR mail IS NULL OR length(mail) NOT BETWEEN 3 AND 320 OR mail<>lower(btrim(mail)) OR label IS NULL OR length(label) NOT BETWEEN 1 AND 100 OR token IS NULL OR token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_request'; END IF;
 -- Serialize enrollment/email linking, including two subjects claiming one mail.
 PERFORM pg_advisory_xact_lock(hashtextextended('tshare-identity',0));
 SELECT user_id,email INTO actor,known_email FROM tshare.identities WHERE issuer=provider AND subject=sub FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tshare.identities WHERE email=mail AND (issuer<>provider OR subject<>sub)) THEN RAISE EXCEPTION 'identity_conflict'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tshare.memberships WHERE user_id=actor AND active) AND NOT EXISTS(SELECT 1 FROM tshare.invitations WHERE email=mail AND status='pending' AND expires_at>now()) THEN RAISE EXCEPTION 'invitation_required'; END IF;
 IF actor IS NULL THEN
  actor:=gen_random_uuid();
  INSERT INTO tshare.users(id,display_name) VALUES(actor,label);
  INSERT INTO tshare.identities(user_id,issuer,subject,email) VALUES(actor,provider,sub,mail);
 ELSE
  UPDATE tshare.identities SET email=mail,updated_at=now() WHERE user_id=actor;
  UPDATE tshare.users SET display_name=label WHERE id=actor;
 END IF;
 UPDATE tshare.sessions SET revoked_at=now() WHERE token_hash=old_token AND revoked_at IS NULL;
 INSERT INTO tshare.sessions(token_hash,user_id) VALUES(token,actor);
END $$;
CREATE FUNCTION tshare.access_session(token text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=tshare.access_user(token); result jsonb;
BEGIN
 SELECT jsonb_build_object('user',jsonb_build_object('id',u.id,'email',i.email,'displayName',u.display_name),
 'organizations',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'role',m.role) ORDER BY o.name,o.id) FROM tshare.memberships m JOIN tshare.organizations o ON o.id=m.organization_id WHERE m.user_id=actor AND m.active),'[]'::jsonb),
 'invitations',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'organization',jsonb_build_object('id',o.id,'name',o.name),'expiresAt',v.expires_at) ORDER BY v.created_at,v.id) FROM tshare.invitations v JOIN tshare.organizations o ON o.id=v.organization_id WHERE v.email=i.email AND v.status='pending' AND v.expires_at>now()),'[]'::jsonb)) INTO result
 FROM tshare.users u JOIN tshare.identities i ON i.user_id=u.id WHERE u.id=actor;
 RETURN result;
END $$;
CREATE FUNCTION tshare.access_logout(token text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 UPDATE tshare.sessions SET revoked_at=now() WHERE token_hash=token AND revoked_at IS NULL
$$;
CREATE FUNCTION tshare.access_accept(token text,invitation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=tshare.access_user(token); mail text; inv tshare.invitations; org_name text; active_now boolean; member_role text;
BEGIN
 SELECT email INTO mail FROM tshare.identities WHERE user_id=actor;
 SELECT * INTO inv FROM tshare.invitations WHERE id=invitation AND email=mail;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 -- All organization mutations lock organization before invitation/membership.
 SELECT name INTO org_name FROM tshare.organizations WHERE id=inv.organization_id FOR UPDATE;
 SELECT * INTO inv FROM tshare.invitations WHERE id=invitation AND email=mail FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT active,role INTO active_now,member_role FROM tshare.memberships WHERE organization_id=inv.organization_id AND user_id=actor;
 IF inv.status='accepted' AND inv.accepted_by=actor THEN
  IF NOT COALESCE(active_now,false) THEN RAISE EXCEPTION 'invitation_unavailable'; END IF;
 ELSIF inv.status<>'pending' OR inv.expires_at<=now() THEN RAISE EXCEPTION 'invitation_unavailable';
 ELSE
  IF COALESCE(active_now,false) THEN RAISE EXCEPTION 'already_member'; END IF;
  INSERT INTO tshare.memberships(organization_id,user_id,role) VALUES(inv.organization_id,actor,'member') ON CONFLICT(organization_id,user_id) DO UPDATE SET active=true,role='member';
  UPDATE tshare.invitations SET status='accepted',accepted_by=actor WHERE id=invitation;
  member_role:='member';
 END IF;
 RETURN jsonb_build_object('organization',jsonb_build_object('id',inv.organization_id,'name',org_name),'membership',jsonb_build_object('role',member_role,'active',true));
END $$;
CREATE FUNCTION tshare.access_invite(token text,org uuid,mail text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; inv tshare.invitations;
BEGIN
 PERFORM 1 FROM tshare.organizations WHERE id=org FOR UPDATE;
 actor:=tshare.access_owner(token,org);
 IF mail IS NULL OR mail<>lower(btrim(mail)) OR length(mail) NOT BETWEEN 3 AND 320 THEN RAISE EXCEPTION 'invalid_request'; END IF;
 IF EXISTS(SELECT 1 FROM tshare.identities i JOIN tshare.memberships m ON m.user_id=i.user_id WHERE i.email=mail AND m.organization_id=org AND m.active) THEN RAISE EXCEPTION 'already_member'; END IF;
 UPDATE tshare.invitations SET status='revoked' WHERE organization_id=org AND email=mail AND status='pending' AND expires_at<=now();
 IF EXISTS(SELECT 1 FROM tshare.invitations WHERE organization_id=org AND email=mail AND status='pending') THEN RAISE EXCEPTION 'invitation_pending'; END IF;
 INSERT INTO tshare.invitations(organization_id,email,created_by) VALUES(org,mail,actor) RETURNING * INTO inv;
 RETURN jsonb_build_object('invitation',jsonb_build_object('id',inv.id,'email',inv.email,'status',inv.status,'expiresAt',inv.expires_at));
END $$;
CREATE FUNCTION tshare.access_members(token text,org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM tshare.access_owner(token,org);
 RETURN jsonb_build_object('members',COALESCE((SELECT jsonb_agg(jsonb_build_object('userId',u.id,'displayName',u.display_name,'role',m.role,'active',m.active) ORDER BY m.created_at,u.id) FROM tshare.memberships m JOIN tshare.users u ON u.id=m.user_id WHERE m.organization_id=org),'[]'::jsonb),
 'invitations',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'status',CASE WHEN i.status='pending' AND i.expires_at<=now() THEN 'expired' ELSE i.status END,'expiresAt',i.expires_at) ORDER BY i.created_at DESC,i.id) FROM tshare.invitations i WHERE i.organization_id=org),'[]'::jsonb));
END $$;
CREATE FUNCTION tshare.access_cancel(token text,org uuid,invitation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM 1 FROM tshare.organizations WHERE id=org FOR UPDATE;
 PERFORM tshare.access_owner(token,org);
 IF NOT EXISTS(SELECT 1 FROM tshare.invitations WHERE id=invitation AND organization_id=org) THEN RAISE EXCEPTION 'not_found'; END IF;
 UPDATE tshare.invitations SET status='revoked' WHERE id=invitation AND organization_id=org AND status='pending';
END $$;
CREATE FUNCTION tshare.access_remove(token text,org uuid,member uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM 1 FROM tshare.organizations WHERE id=org FOR UPDATE;
 PERFORM tshare.access_owner(token,org);
 IF NOT EXISTS(SELECT 1 FROM tshare.memberships WHERE organization_id=org AND user_id=member) THEN RAISE EXCEPTION 'not_found'; END IF;
 BEGIN
  UPDATE tshare.memberships SET active=false WHERE organization_id=org AND user_id=member;
 EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'last_owner'; END;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tshare FROM PUBLIC;
INSERT INTO tshare.schema_migrations(version) VALUES(3);
