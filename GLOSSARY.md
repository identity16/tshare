# tshare

Vocabulary for publishing, reviewing and reusing artifacts. This includes agreed team concepts; released features are listed in the roadmap.

## Language

**Organization**:
The team that owns a body of work, its membership and its subscription. An organization is the tenant boundary in Cloud.
_Avoid_: Account, tenant as a separate business entity

**User**:
A person who can belong to more than one organization. Signing in identifies the person; membership determines which organization they can enter.
_Avoid_: Organization, account

**Membership**:
A user's active relationship with an organization and the permissions it grants. An invitation offers membership; it does not itself authenticate a person.

**Workspace**:
A library of artifacts within an organization. An organization starts with one workspace; a workspace is not a separate billing customer.
_Avoid_: Tenant, organization

**Artifact**:
A named piece of shared work whose stable link can open successive published revisions.
_Avoid_: Revision, uploaded file as a synonym for the whole artifact

**Revision**:
One published, immutable snapshot of an artifact and its supporting files. Feedback remains attached to the revision actually reviewed.
_Avoid_: Current artifact, overwrite

**Publication**:
The act of making a complete revision available through an artifact. Transferring some files is not yet a publication.

**Feedback**:
A question, suggestion, change request or recorded decision concerning a reviewed revision. Resolving feedback records an outcome; it does not establish human approval or grant an agent new authority.

**Member**:
An invited person with active organization membership who can read, publish and review its shared work. A member can replace or delete their own artifacts.

**Owner**:
An organization member who also manages membership and the organization’s artifacts. Ownership does not change which revision a review concerns.
