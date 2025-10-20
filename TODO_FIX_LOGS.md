# Fix Runtime Crashes Due to Missing Logs Directory

## Information Gathered
- `authController.js` has `adminLogin` function that uses `logMessage` to write to `/app/logs/admin-login.log` (Railway path)
- `logMessage` function uses `fs.appendFileSync(logFile, logEntry)` without checking if directory exists
- `server.js` does not create logs directory at startup
- Local `logs/` directory exists but is empty
- Railway deployment fails with ENOENT when trying to write to missing logs directory

## Plan
- Modify `server.js` to auto-create `/logs` directory at startup using `path.join(process.cwd(), 'logs')` and `fs.mkdirSync(..., { recursive: true })`
- Harden `logMessage` function in `authController.js` with try/catch around `fs.appendFileSync` and fallback to `console.error`
- Add `logs/.gitkeep` file to ensure directory is tracked in git
- Commit changes with message "fix(logs): create logs dir & safe logging"
- Push to main branch
- Trigger Railway redeploy
- Validate `/api/health` endpoint succeeds
- Validate `/api/auth/admin/login` endpoint succeeds
- Capture last 50 lines of server log
- Capture contents of `logs/admin-login.log` if present
- Report any errors and remediation steps

## Tasks
- [x] Modify server.js to auto-create /logs directory at startup
- [x] Harden logMessage function in authController.js with try/catch
- [x] Add logs/.gitkeep file
- [ ] Commit changes with message "fix(logs): create logs dir & safe logging"
- [ ] Push to main branch
- [ ] Trigger Railway redeploy
- [ ] Validate /api/health endpoint succeeds
- [ ] Validate /api/auth/admin/login endpoint succeeds
- [ ] Capture last 50 lines of server log
- [ ] Capture contents of logs/admin-login.log if present
- [ ] Report any errors and remediation steps
