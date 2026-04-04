# GraphiTab Change Log

## 0.3.0 (2026-04-04)

- Reworked network requests to resolve CORS issues in Firefox.
- Added support for Automatic Persisted Queries (APQ) in the DevTools panel.
- Added a divider to the request list in the DevTools panel when a navigation
  occurs during Preserve Log mode.
- Added an inspector in the DevTools panel for JWT tokens in headers.
- Added a toolbar function (the icons to the right of the query) in GraphiQL
  that allows you to specify an `extensions` payload to include in the query.
- Added the ability to open a query from the DevTools panel into a GraphiQL
  tab.

## 0.2.0 (2026-03-22)

- Added a DevTools panel for capturing and examining GraphQL requests.
- Added ability to open saved queries in a new GraphiQL tab instead of
  overwriting the active tab.
- Fixed issue with WebSocket-based subscriptions not working at all.
- Adjusted extension permissions to allow it to call any URL without CORS
  issues.
- Minor styling fixes.

## 0.1.0 (2026-02-19)

- Initial release.
