# Admin Login Fix TODO

## 1. Validate Route Registration
- [x] Add route logging in server.js to list all loaded routes at startup
- [x] Verify /api/auth/admin/login is registered correctly

## 2. Verify MongoDB Connection and Admin Record
- [x] Connect to MongoDB Atlas
- [x] Query for admin@kenlukapp.com
- [x] Ensure isAdmin: true, isVerified: true
- [x] If missing/incorrect, create/update with hashed password

## 3. Fix Request Validation Mismatch
- [x] Review validateLogin middleware
- [x] Ensure it accepts admin credentials

## 4. Improve Logging & Error Tracing
- [x] Add detailed logs in adminLogin() function
- [x] Log user not found, password fail, not admin
- [x] Output to console and logs/admin-login.log

## 5. Eliminate 404 Interference
- [x] Ensure app.use('*', ...) is mounted after all API routes

## 6. Rebuild & Redeploy
- [x] Restart Railway container
- [x] Confirm /api/health works

## 7. Test Endpoint
- [x] POST https://kenluk-backend-production.up.railway.app/api/auth/admin/login
- [x] Payload: {"email": "admin@kenlukapp.com", "password": "Admin123!"}
- [x] Expect success with JWT token
