#!/bin/sh

SCRIPT_DIR=$(dirname $0)

echo "window.env = {" > public/env.js
echo "  NEXT_PUBLIC_API_URL: '$NEXT_PUBLIC_API_URL'" >> $SCRIPT_DIR/public/env.js
echo "  NEXT_PUBLIC_API_WS_URL: '$NEXT_PUBLIC_API_WS_URL'" >> $SCRIPT_DIR/public/env.js
echo "  NEXT_PUBLIC_PUBLIC_URL: '$NEXT_PUBLIC_PUBLIC_URL'" >> $SCRIPT_DIR/public/env.js
echo "}" >> $SCRIPT_DIR/public/env.js

node $SCRIPT_DIR/server.js
