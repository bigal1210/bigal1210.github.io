# Ramblings password protection

The protected build encrypts the existing Ramblings HTML, JavaScript, and artwork
with AES-256-GCM and a password-derived key (PBKDF2-SHA-256, 600,000 iterations,
fresh random salt and IV). The password is not included in the published files.
The original source files stay editable, preserving the current uncommitted work.

From the website directory, build using a unique, long password. In zsh, enter
it without putting it in shell history:

```sh
read -rs 'RAMBLINGS_PASSWORD?Ramblings password: '
export RAMBLINGS_PASSWORD
node tools/protect-ramblings.mjs
unset RAMBLINGS_PASSWORD
```

Preview the generated site:

```sh
python3 -m http.server 8001 --bind 127.0.0.1 --directory .protected-site
```

Open http://127.0.0.1:8001/nothinghereyet.html. Unlocking restores the original
watermelon, seed writing, baseball, and arrow navigation. Reloading stays unlocked for the current tab session. A tab-scoped decryption
key is kept in sessionStorage; the password is never saved by the page. Browser
session restore or duplicating a tab may retain that session. A fresh independent
tab asks for the password again. Rebuilding changes the salt and invalidates saved
unlock keys. If browser storage is disabled, refreshing asks again.
The browser must support Web Crypto and WebGL. Use HTTPS when hosting the site.

Only publish `.protected-site/`, never the source checkout. It includes the other
public pages, the lock page, and encrypted Ramblings data; it excludes the original
assets and artwork tools. The existing preview on port 8000 serves editable source
and is not protected. Rebuild after changing the artwork, writing, or password.
The generated folder is ignored by Git. Building replaces its contents.

The build command does not publish anything. GitHub Pages publishes the root of
the `gh-pages` branch; `main` keeps the editable source. For updates, rebuild and
replace the deployment branch contents with `.protected-site/`, preserving its
Git history. Never deploy the source checkout to the Pages branch. If the repository
or earlier commits are public, the existing writing and images can still be read
there. Encryption cannot withdraw previously public copies. Keep future private
writing in a private source repository. Use a strong password: downloaded encrypted
data permits offline password guesses. Changing the password does not revoke old
copies. Someone with the password can save the decrypted content.
