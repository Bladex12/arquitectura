"""
Serves the built React SPA (frontend/dist/, produced by `npm run build`)
directly from Django so the whole app runs behind one HTTPS domain
(API Gateway), with no separate S3/CloudFront frontend origin.

Registered as the LAST urlpattern in urls.py so it never shadows api/*,
admin/*, static/*, or media/*.
"""
import os

from django.conf import settings
from django.views.static import serve as static_serve


def spa_view(request, path=''):
    dist_dir = str(settings.FRONTEND_DIST_DIR)
    requested = os.path.normpath(os.path.join(dist_dir, path.lstrip('/')))

    # Path-traversal guard: normpath could walk above dist_dir via `..`.
    if not requested.startswith(dist_dir):
        return static_serve(request, 'index.html', document_root=dist_dir)

    if path and os.path.isfile(requested):
        rel_path = os.path.relpath(requested, dist_dir)
        return static_serve(request, rel_path, document_root=dist_dir)

    # No file at this path (client-side route like /profesor/panel, or a
    # refresh/deep-link) -> hand back the SPA shell so React Router renders.
    return static_serve(request, 'index.html', document_root=dist_dir)
