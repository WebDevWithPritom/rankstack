export * from './local-db';
// This file serves as the clean abstraction layer. If RANKSTACK_STORE=supabase is added later,
// this file will conditionally delegate to supabase-db.ts. For v1, it directly delegates to local-db.
