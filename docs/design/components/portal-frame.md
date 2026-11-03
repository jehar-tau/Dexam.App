# PortalFrame

Status: approved composition under D-048 B; visual language updated by D-064. See [Discovery 1.0](../DISCOVERY.md).
Source: `dexam-portfolio-design-system/project/patterns/layout/SidebarLayout.jsx` and `project/components/navigation/SidebarItem.jsx` at pinned commit `4acbb1b`.
Storybook: `Patterns/Layout/PortalFrame`.

Teacher uses a compact review rail; Staff an operations sidebar; Admin a protected-operation header/sidebar. Public and student authentication screens use horizontal navigation. Authenticated students and candidates use `StudentShell` with the shared left sidebar under D-059/D-062, including an accessible phone drawer. All use the Discovery semantic colors, typography, spacing, border tokens, and Brand component. Role identification remains explicit in text; visual changes grant no authority.

States: public/signed-out, each portal, mobile wrapping, pending/error/denied navigation supplied by the authorized navigation component, and staging banner. Main content retains its own loading/empty/error states. Sidebar collapses into wrapping navigation on narrow viewports; main uses min-width zero and bounded gutters. No hover-only controls, hidden drawer or new icon set.

Accessibility: native links, nav landmark, labelled primary navigation, skip-to-main, visible global focus, readable labels and no nested interactive cards. Distinguish portal with text, not color alone. No secrets/session data in the presentational frame. Do not infer permissions from portal attribute, colors or URL. Verify keyboard use, mobile widths and content overflow across existing workflows.
