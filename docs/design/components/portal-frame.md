# PortalFrame

Status: approved composition under D-048 B; implementation verification pending.
Source: `dexam-portfolio-design-system/project/patterns/layout/SidebarLayout.jsx` and `project/components/navigation/SidebarItem.jsx` at pinned commit `4acbb1b`.
Storybook: `Patterns/Layout/PortalFrame`.

Student uses learning-first horizontal navigation; Teacher a compact review rail; Staff an operations sidebar; Admin a protected-operation header/sidebar. Use only pinned semantic colors, typography, spacing and border tokens. This is four audience layouts in one component, not four design systems or a role grant.

States: public/signed-out, each portal, mobile wrapping, pending/error/denied navigation supplied by the authorized navigation component, and staging banner. Main content retains its own loading/empty/error states. Sidebar collapses into wrapping navigation on narrow viewports; main uses min-width zero and bounded gutters. No hover-only controls, hidden drawer or new icon set.

Accessibility: native links, nav landmark, labelled primary navigation, skip-to-main, visible global focus, readable labels and no nested interactive cards. Distinguish portal with text, not color alone. No secrets/session data in the presentational frame. Do not infer permissions from portal attribute, colors or URL. Verify keyboard use, mobile widths and content overflow across existing workflows.
