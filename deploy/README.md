# Production: Dipto Bro

Repository: https://github.com/Dawat-IT/sigma-erp
Host: `187.127.141.81`, domain: `royal.dawatit.online`.

The current local application is the source of truth. Git history is preserved.
The deployment uses the server's existing Node.js, PM2 and Nginx. No Docker is
required on the VPS. MongoDB must be persistent: use Atlas or a separately
provisioned authenticated MongoDB service. Database provisioning is separate from
application deployment. Never use `MONGODB_URI=memory` in production.

## Server setup

Create `/opt/sigma-erp/releases` and `/opt/sigma-erp/.env` from
`production.env.example`. Set a persistent MongoDB URI and an independent
`openssl rand -hex 32` authentication secret. Set file mode 600. Node 22+ is
required. The application listens only on `127.0.0.1:3100`.

Install `nginx.conf` as `/etc/nginx/sites-available/royal.dawatit.online`, enable
its symlink, run `nginx -t`, and reload nginx. Point the domain A record to the
host before issuing TLS with `certbot --nginx -d royal.dawatit.online --redirect`.
HTTPS is required for production session cookies. The PM2 startup service must
be enabled so saved processes survive a server reboot.

## GitHub Actions

Every main push and pull request builds the application, checks deployment-related
TypeScript, and tests the actual standalone production server against MongoDB.
The existing application has legacy lint errors; full lint is reported as advisory.
Build/type errors and production smoke failures block deployment.

Configure repository secrets `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`,
`VPS_KNOWN_HOSTS`. Use a dedicated key and verified host key; passwords are not
stored in GitHub. Only enable repository variable `VPS_DEPLOY_ENABLED=true` once
the server, reverse proxy, and runtime secrets are ready. Deployment uses the
`production` GitHub environment and only runs for main, never pull requests.

The pipeline uploads its tested Linux standalone artifact and invokes `deploy.sh`.
Each release is stored under its commit SHA. Only PM2's `sigma-erp` process is
restarted, with a brief interruption during startup. A failed update restores
the previous release's PM2 configuration.
The first deployment has no earlier release to restore. Old releases remain
available for rollback. Runtime secrets stay outside the release archive and
are loaded directly by Node's `--env-file` argument.

## Initial administrator

Demo password overrides and demo seeding are disabled in production. Create the
initial account once with the bootstrap script; it refuses to overwrite accounts:

```bash
cd /opt/sigma-erp/current/app
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -s -p 'Admin password (16+ characters): ' ADMIN_PASSWORD; echo
export ADMIN_EMAIL ADMIN_PASSWORD
node --env-file=/opt/sigma-erp/.env bootstrap-admin.cjs
unset ADMIN_EMAIL ADMIN_PASSWORD
```

This creates an administrator, not demo inventory or financial records. Configure
the business and users through the application's settings.

## Manual rollback

```bash
release=/opt/sigma-erp/releases/KNOWN_GOOD_COMMIT_SHA
pm2 delete sigma-erp
pm2 start "$release/ecosystem.config.cjs" --only sigma-erp
curl --fail http://127.0.0.1:3100/api/health
ln -sfn "$release" /opt/sigma-erp/current.next
mv -Tf /opt/sigma-erp/current.next /opt/sigma-erp/current
pm2 save
```

Rollback restores application code; it does not reverse database schema/data
changes. Database backups should be stored off the VPS.
