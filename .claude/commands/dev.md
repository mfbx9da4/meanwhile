Start the dev server on 0.0.0.0 so it's accessible from other devices on the network.

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
npm run dev -- --host 0.0.0.0
```
