-- ============================================================================
-- comGpt free plan
--
-- V2 is immutable, so the free plan is introduced in this new migration.
-- The stable UUID is referenced by the billing and organization modules as
-- the default plan for every newly created workspace.
--
-- The free plan grants the same feature flags as Starter (automation and the
-- shared inbox) but with starter-level limits: one seat, one workspace and a
-- 500-contact directory. Premium capabilities (white-label, SSO, SLA, API
-- access) are explicitly disabled.
-- ============================================================================

insert into plans (id, code, name, description, price_monthly_cents, currency,
                   included_emails, included_whatsapp, included_sms,
                   overage_email_micros, overage_whatsapp_micros, overage_sms_micros,
                   features, is_public, sort_order) values
  ('20000000-0000-0000-0000-000000000005', 'FREE', 'Free',
   'Free forever for solo marketers and small teams launching their first campaigns',
   0, 'USD', 2000, 200, 100, 0, 0, 0,
   '{"contacts":500,"seats":1,"workspaces":1,"automation":true,"inbox":true,
     "white_label":false,"sso":false,"sla":false,"api_access":false}', true, 0)
on conflict do nothing;

-- Any workspace created without an explicit plan (for example by an older
-- integration) falls back to the free plan instead of having no plan at all.
update organizations
   set plan_id = '20000000-0000-0000-0000-000000000005'
 where plan_id is null;

alter table organizations
  alter column plan_id set default '20000000-0000-0000-0000-000000000005';
