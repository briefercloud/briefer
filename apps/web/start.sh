#!/bin/sh

SCRIPT_DIR=$(dirname $0)

echo "window.env = {}" > $SCRIPT_DIR/public/env.js
echo "window.env.NEXT_PUBLIC_API_URL = '$NEXT_PUBLIC_API_URL'" >> $SCRIPT_DIR/public/env.js
echo "window.env.NEXT_PUBLIC_API_WS_URL = '$NEXT_PUBLIC_API_WS_URL'" >> $SCRIPT_DIR/public/env.js
echo "window.env.NEXT_PUBLIC_PUBLIC_URL = '$NEXT_PUBLIC_PUBLIC_URL'" >> $SCRIPT_DIR/public/env.js

HOSTNAME=0.0.0.0 PORT=4000 node $SCRIPT_DIR/server.js
