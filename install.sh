#!/bin/bash
UUID="gateway-watcher@yourusername.example.com"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST/schemas"
cp extension.js prefs.js metadata.json stylesheet.css "$DEST/"
cp schemas/*.xml "$DEST/schemas/"

glib-compile-schemas "$DEST/schemas/"

echo "Installed successfully. Log out and back in, then enable 'Gateway Status Pro'."
