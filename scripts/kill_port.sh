## kill port script
#!/bin/bash
if [ -z "$1" ]; then
  echo "Usage: $0 <port>"
  exit 1
fi
PORT=$1
PID=$(lsof -t -i:$PORT)
if [ -z "$PID" ]; then
  echo "No process found running on port $PORT"
  exit 0
fi
echo "Killing process $PID running on port $PORT"
kill -9 $PID
echo "Process $PID killed"
exit 0
# End of kill port script