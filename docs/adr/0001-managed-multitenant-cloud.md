# Managed multi-tenant Cloud with shared services and isolated organization data

Status: accepted direction; implementation and provisioned resources are pending.

Cloud will use stateless application services, managed PostgreSQL for metadata, private object storage for artifact files, and durable asynchronous workers. The initial deployment target is an independent GCP environment with Cloud Run, Cloud SQL PostgreSQL, Cloud Storage and Cloud Tasks. An organization is the tenant boundary; users may belong to multiple organizations. This avoids growing the current single-owner SQLite/local-directory process into a persistent server per customer.

Cloud tenancy, billing and fleet operation remain in a private codebase, using common open-source authentication, authorization, publishing, content and review behavior rather than a fork. The existing SQLite/local-file CLI and optional UI remain supported without a Cloud account or storage migration. Hosted Cloud is not yet available, and adopting this direction does not authorize billable infrastructure creation.

Uploaded active content must be isolated from the authenticated application origin. Sharing a document points to an authorization-checked reader; a signed storage or preview URL is a temporary bearer capability, not a person-bound sharing policy. Content delivery, revocation behavior and browser compatibility require a working proof before their contracts are frozen. Details are tracked in the [Cloud foundation draft](../cloud-foundation.md).
