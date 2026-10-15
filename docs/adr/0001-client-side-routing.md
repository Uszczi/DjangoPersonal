# Client-side routing with TanStack Router

DjangoPersonal's React interface kept all navigation in component state, so refreshing the page or using the browser's back button lost the current view and the selected Project, and there was no URL to bookmark. We adopted TanStack Router with file-based routing and the browser history, so each view has a stable URL and the selected Project is part of the URL.

Status: accepted

Considered Options:

- **Code-based routing**: rejected because it requires maintaining the route tree by hand; file-based routing keeps route files next to the pages they render.
- **Hash history**: rejected because clean URLs are preferable and development already serves the app as a single-page application.
- **Router loaders or a data-fetching library**: rejected for now; components keep fetching after they mount, so the router changes navigation only.

Consequences:

- The route tree, generated route types, and navigation API are woven through the frontend; swapping routers later would be a substantial rewrite.
