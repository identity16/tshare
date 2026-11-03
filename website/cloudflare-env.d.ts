declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    WAITLIST_OWNER_ID?: string;
    BUCKET?: R2Bucket;
  }
}
