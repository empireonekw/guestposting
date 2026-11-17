#!/usr/bin/env bash
# Moves guestposting.live's database from MongoDB Atlas to MongoDB on this server (run as root). Safe to re-run.
# Changes only the database: the site's code is not pulled or rebuilt.
#
# 1. Uses the MongoDB already running here for sellpify/dirndlwear (127.0.0.1:27017, logins on, never reachable
#    from the internet) and gives this site its own login for its own database `guestposting`.
# 2. Stops the site for the copy (a few seconds, so no sign-up or order made meanwhile is lost), copies Atlas's
#    database (`test`, the default when MONGO_URI names none) and checks every collection has the same count.
# 3. Points MONGO_URI in .env at the local database (the old .env is kept as .env.atlas-<time>), starts the site and
#    checks it uses the local database. If anything fails, the site is started again on Atlas by itself.
#
# Back to Atlas by hand:  cp /www/wwwroot/guestposting/.env.atlas-<time> /www/wwwroot/guestposting/.env && pm2 restart guestposting --update-env
set -euo pipefail

main() {

APP=guestposting
PORT=3100
APP_DIR=/www/wwwroot/guestposting
ENV_FILE="$APP_DIR/.env"
DST_DB=guestposting
ADMIN_CREDS=/root/.mongodb-sellpify   # this server's MongoDB admin login (made by sellpify's mongo-local.sh)
CREDS=/root/.mongodb-guestposting
BACKUP_ROOT=/root/mongo-backup
MARK='written by guestposting scripts/server/mongo-local.sh'

say()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mXX  %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "Please run this as root."
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found."
pm2 describe "$APP" >/dev/null 2>&1 || die "PM2 app '$APP' not found."

umask 077
TMP=$(mktemp -d)
STOPPED=0
SWITCHED=0
cleanup() {
  rm -rf "$TMP"
  # Stopped for the copy but never switched over: run the site on Atlas again.
  if [ "$STOPPED" = 1 ] && [ "$SWITCHED" = 0 ]; then
    pm2 restart "$APP" --update-env >/dev/null 2>&1 && echo "The site was started again on Atlas (nothing changed)."
  fi
}
trap cleanup EXIT

site_up() {
  local i
  for i in $(seq 1 30); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' -m 10 "http://127.0.0.1:$PORT/api/listings" || true)" = 200 ] && return 0
    sleep 3
  done
  return 1
}

# --------------------------------------------------------------- 1. checks + login
say "1/4 MongoDB on this server"
command -v mongosh >/dev/null 2>&1 && command -v mongodump >/dev/null 2>&1 || die "MongoDB tools are not installed here."
[ -f "$ADMIN_CREDS" ] || die "$ADMIN_CREDS (the MongoDB admin password) is missing."
ADMIN_PW=$(grep -m1 '^ADMIN_PW=' "$ADMIN_CREDS" | cut -d= -f2-)
[ -n "$ADMIN_PW" ] || die "No ADMIN_PW in $ADMIN_CREDS."
ADMIN_URI="mongodb://admin:$ADMIN_PW@127.0.0.1:27017/?authSource=admin"
mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' mongodb://127.0.0.1:27017/admin 2>/dev/null | grep -q 1 ||
  die "MongoDB is not answering on 127.0.0.1:27017. See: systemctl status mongod"

CUR_URI=$(grep -m1 '^MONGO_URI=' "$ENV_FILE" | cut -d= -f2- | tr -d "\r'\"")
[ -n "$CUR_URI" ] || die "MONGO_URI is missing in $ENV_FILE."
case "$CUR_URI" in
  *@127.0.0.1:27017/*) say "Done"; echo "The site already uses the local database."; return 0 ;;
esac
# Database = the path of the URI (…mongodb.net/<name>?…); none means Mongoose's default "test".
SRC_DB=$(printf '%s' "$CUR_URI" | sed -E 's#^mongodb(\+srv)?://[^/]+/?([^?]*).*#\2#')
[ -n "$SRC_DB" ] || SRC_DB=test
SRC_URI=$(printf '%s' "$CUR_URI" | sed -E "s#^(mongodb(\+srv)?://[^/?]+)/?[^?]*#\1/$SRC_DB#")

[ -f "$CREDS" ] || printf '# MongoDB password for guestposting.live (%s)\nAPP_PW=%s\n' "$MARK" "$(openssl rand -hex 24)" > "$CREDS"
chmod 600 "$CREDS"
APP_PW=$(grep -m1 '^APP_PW=' "$CREDS" | cut -d= -f2-)
ADMIN_PW="$ADMIN_PW" APP_PW="$APP_PW" DB="$DST_DB" APP="$APP" mongosh --quiet mongodb://127.0.0.1:27017/admin --eval '
  db.auth("admin", process.env.ADMIN_PW);
  const d = db.getSiblingDB(process.env.DB);
  const roles = [{ role: "readWrite", db: process.env.DB }, { role: "dbAdmin", db: process.env.DB }];
  if (d.getUser(process.env.APP)) d.updateUser(process.env.APP, { pwd: process.env.APP_PW, roles });
  else d.createUser({ user: process.env.APP, pwd: process.env.APP_PW, roles });' >/dev/null
LOCAL_URI="mongodb://$APP:$APP_PW@127.0.0.1:27017/$DST_DB?authSource=$DST_DB"
echo "OK   login '$APP' can read and write database '$DST_DB' (password in $CREDS)"

U="$SRC_URI" mongosh --quiet --nodb --eval 'connect(process.env.U).runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1 ||
  die "Cannot reach Atlas with the MONGO_URI in $ENV_FILE. Nothing was changed."

# --------------------------------------------------------------- 2. copy (site stopped)
say "2/4 Copying '$SRC_DB' from Atlas to '$DST_DB' here (site paused for a few seconds)"
OUT="$BACKUP_ROOT/guestposting-atlas-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
printf "uri: '%s'\n" "$SRC_URI" > "$TMP/src.yaml"
printf "uri: '%s'\n" "$ADMIN_URI" > "$TMP/dst.yaml"
pm2 stop "$APP" >/dev/null
STOPPED=1
mongodump --config="$TMP/src.yaml" --out="$OUT" --quiet || die "Could not read from Atlas. Nothing was switched."
[ -d "$OUT/$SRC_DB" ] || die "Atlas has no database '$SRC_DB'. Nothing was switched."
mongorestore --config="$TMP/dst.yaml" --dir="$OUT" --nsInclude="$SRC_DB.*" \
  --nsFrom="$SRC_DB.*" --nsTo="$DST_DB.*" --drop --quiet || die "Could not write the copy. Nothing was switched."

COUNT_JS='const d = connect(process.env.U);
  print(d.getCollectionNames().filter((c) => !c.startsWith("system.")).sort()
    .map((c) => c + "=" + d.getCollection(c).countDocuments()).join("\n"));'
U="$SRC_URI" mongosh --quiet --nodb --eval "$COUNT_JS" > "$TMP/atlas.txt"
U="$LOCAL_URI" mongosh --quiet --nodb --eval "$COUNT_JS" > "$TMP/local.txt"
if ! diff -q "$TMP/atlas.txt" "$TMP/local.txt" >/dev/null; then
  diff "$TMP/atlas.txt" "$TMP/local.txt" || true
  die "The copy does not match Atlas (above: Atlas < > local). Nothing was switched. Run this again."
fi
sed 's/^/     /' "$TMP/local.txt"
echo "OK   all $(wc -l < "$TMP/local.txt") collections copied, same document counts as Atlas (copy kept in $OUT)"

# --------------------------------------------------------------- 3. switch
say "3/4 Switching the site to the local database"
BAK="$ENV_FILE.atlas-$(date +%Y%m%d-%H%M%S)"
cp -p "$ENV_FILE" "$BAK"
awk -v u="$LOCAL_URI" '/^MONGO_URI=/ && !done { print "MONGO_URI=" u; done = 1; next } { print }' "$ENV_FILE" > "$TMP/env"
cat "$TMP/env" > "$ENV_FILE"
SWITCHED=1
pm2 restart "$APP" --update-env >/dev/null || true

# The site must answer AND hold connections as this site's own login (sellpify/dirndlwear also connect to 27017).
conns=0
if site_up; then
  conns=$(ADMIN_PW="$ADMIN_PW" APP="$APP" mongosh --quiet mongodb://127.0.0.1:27017/admin --eval '
    db.auth("admin", process.env.ADMIN_PW);
    print(db.getSiblingDB("admin").aggregate([{ $currentOp: { allUsers: true, idleConnections: true } },
      { $match: { "effectiveUsers.user": process.env.APP } }]).toArray().length);' 2>/dev/null | tail -1)
fi
case "$conns" in ''|*[!0-9]*) conns=0 ;; esac
if [ "$conns" -lt 1 ]; then
  cat "$BAK" > "$ENV_FILE"
  pm2 restart "$APP" --update-env >/dev/null
  pm2 logs "$APP" --err --lines 15 --nostream 2>/dev/null | tail -15 || true
  die "The site did not come up on the local database, so it was switched back to Atlas (running again)."
fi
pm2 save >/dev/null
echo "OK   site answering on the local database ($conns connections as '$APP')"

say "4/4 Done"
echo "guestposting.live now uses MongoDB on this server (database '$DST_DB')."
echo "  Atlas copy taken just now:  $OUT"
echo "  Nightly backups:            /root/mongo-backup/nightly-*.gz (02:30, 14 days)"
echo "  Password:                   $CREDS"
echo "  Back to Atlas:              cp $BAK $ENV_FILE && pm2 restart $APP --update-env"
echo "Keep the Atlas database for a few days before deleting it."
}

main "$@"
