-- ============================================================================
-- OmniFlow reference data: roles and plans
-- Stable UUIDs are used so application code and seeds can reference them.
-- ============================================================================

insert into roles (id, code, name, description, permissions) values
  ('10000000-0000-0000-0000-000000000001', 'OWNER', 'Owner',
   'Full control of the organization, billing and members',
   '["org:manage","billing:manage","member:manage","campaign:manage","contact:manage","automation:manage","inbox:manage","analytics:view"]'),
  ('10000000-0000-0000-0000-000000000002', 'ADMIN', 'Administrator',
   'Manage members, integrations and all marketing resources',
   '["member:manage","campaign:manage","contact:manage","automation:manage","inbox:manage","analytics:view","integration:manage"]'),
  ('10000000-0000-0000-0000-000000000003', 'MARKETING_MANAGER', 'Marketing Manager',
   'Create campaigns, automations and segments',
   '["campaign:manage","contact:manage","automation:manage","analytics:view","template:manage"]'),
  ('10000000-0000-0000-0000-000000000004', 'CAMPAIGN_MANAGER', 'Campaign Manager',
   'Create and launch campaigns',
   '["campaign:manage","contact:view","template:manage","analytics:view"]'),
  ('10000000-0000-0000-0000-000000000005', 'AGENT', 'Support Agent',
   'Handle inbox conversations',
   '["inbox:manage","contact:view"]'),
  ('10000000-0000-0000-0000-000000000006', 'VIEWER', 'Viewer',
   'Read-only access',
   '["contact:view","campaign:view","analytics:view","inbox:view"]'),
  ('10000000-0000-0000-0000-000000000007', 'AGENCY_OWNER', 'Agency Owner',
   'Manage agency workspaces and client organizations',
   '["org:manage","workspace:manage","member:manage","billing:manage","campaign:manage","contact:manage","analytics:view"]'),
  ('10000000-0000-0000-0000-000000000008', 'PLATFORM_ADMIN', 'Platform Administrator',
   'Internal OmniFlow platform administration',
   '["platform:manage"]')
on conflict (id) do nothing;

insert into plans (id, code, name, description, price_monthly_cents, currency,
                   included_emails, included_whatsapp, included_sms,
                   overage_email_micros, overage_whatsapp_micros, overage_sms_micros,
                   features, sort_order) values
  ('20000000-0000-0000-0000-000000000001', 'STARTER', 'Starter',
   'For small businesses getting started with omnichannel marketing',
   2900, 'USD', 10000, 1000, 1000, 900, 4000, 3500,
   '{"contacts":5000,"seats":3,"automation":true,"inbox":true,"white_label":false}', 10),
  ('20000000-0000-0000-0000-000000000002', 'GROWTH', 'Growth',
   'For growing teams running campaigns across every channel',
   9900, 'USD', 50000, 5000, 5000, 750, 3500, 3000,
   '{"contacts":50000,"seats":10,"automation":true,"inbox":true,"white_label":false}', 20),
  ('20000000-0000-0000-0000-000000000003', 'AGENCY', 'Agency',
   'Multi-workspace plan for agencies managing client brands',
   24900, 'USD', 200000, 20000, 20000, 700, 3200, 2800,
   '{"contacts":200000,"seats":25,"workspaces":20,"automation":true,"inbox":true,"white_label":true}', 30),
  ('20000000-0000-0000-0000-000000000004', 'ENTERPRISE', 'Enterprise',
   'Custom volume, SLAs and dedicated infrastructure',
   0, 'USD', 0, 0, 0, 0, 0, 0,
   '{"contacts":-1,"seats":-1,"workspaces":-1,"automation":true,"inbox":true,"white_label":true,"sso":true,"sla":true}', 40)
on conflict (id) do nothing;
