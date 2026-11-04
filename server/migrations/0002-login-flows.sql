CREATE TABLE tshare.login_flows(
 state_hash text PRIMARY KEY CHECK(state_hash ~ '^[a-f0-9]{64}$'),
 binding_hash text NOT NULL CHECK(binding_hash ~ '^[a-f0-9]{64}$'),
 code_verifier text NOT NULL CHECK(char_length(code_verifier) BETWEEN 43 AND 128),
 nonce text NOT NULL CHECK(char_length(nonce) BETWEEN 32 AND 128),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_flows_expiry ON tshare.login_flows(expires_at);
ALTER TABLE tshare.login_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tshare.login_flows FORCE ROW LEVEL SECURITY;
CREATE POLICY bound_flow ON tshare.login_flows USING(
 state_hash=NULLIF(current_setting('tshare.login_state_hash',true),'')
 AND binding_hash=NULLIF(current_setting('tshare.login_binding_hash',true),'')
) WITH CHECK(
 state_hash=NULLIF(current_setting('tshare.login_state_hash',true),'')
 AND binding_hash=NULLIF(current_setting('tshare.login_binding_hash',true),'')
);
REVOKE ALL ON tshare.login_flows FROM PUBLIC;
INSERT INTO tshare.schema_migrations(version) VALUES(2);
