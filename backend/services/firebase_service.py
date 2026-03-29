"""
Firebase Admin SDK initialization for backend services.
Provides Firestore client for server-side database operations.

Configuration via environment variables:
  - GOOGLE_APPLICATION_CREDENTIALS: path to service account JSON file
  - OR FIREBASE_SERVICE_ACCOUNT_JSON: raw JSON string of service account
  - OR FIREBASE_PROJECT_ID: project ID only (uses Application Default Credentials)
"""
import json
import os

import firebase_admin
from firebase_admin import credentials, firestore

_app = None


def _initialize_firebase():
    """Initialize Firebase Admin SDK (idempotent)."""
    global _app
    if _app is not None:
        return _app

    # Option 1: GOOGLE_APPLICATION_CREDENTIALS env var (standard)
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and os.path.isfile(cred_path):
        cred = credentials.Certificate(cred_path)
        _app = firebase_admin.initialize_app(cred)
        return _app

    # Option 2: Raw JSON string (useful for EasyPanel / Docker secrets)
    raw_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw_json:
        service_info = json.loads(raw_json)
        cred = credentials.Certificate(service_info)
        _app = firebase_admin.initialize_app(cred)
        return _app

    # Option 3: Project ID only (Application Default Credentials)
    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if project_id:
        _app = firebase_admin.initialize_app(options={"projectId": project_id})
        return _app

    # Fallback: try default credentials
    _app = firebase_admin.initialize_app()
    return _app


def get_firestore_db():
    """Return an initialized Firestore client."""
    _initialize_firebase()
    return firestore.client()
