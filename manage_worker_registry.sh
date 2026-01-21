#!/bin/bash

# Manage worker registry
# To add a worker:
# ./manage_worker_registry.sh --add {"name": "Alice", "phone": "+1234567890", languages: ["en", "es"]}
# To update a worker:
# ./manage_worker_registry.sh --update {"name": "Alice", "phone": "+1234567890", languages: ["en", "es"]}
# To remove a worker:
# ./manage_worker_registry.sh --remove <worker_id>


# THIS IS BROKEN / AI HALLUCINATION? getopts doesn't support long flags!
#while getopts ":add:update:remove:service_sid:environment_sid:attributes:file:" opt; do
#  case ${opt} in
#    service_sid ) SERVICE_SID=$OPTARG;;
#    environment_sid ) ENVIRONMENT_SID=$OPTARG;;
#    attributes ) ATTRIBUTES=$OPTARG;;
#    file ) FILE=$OPTARG;;
#    add ) ACTION="add";;
#    update ) 
#      ACTION="update"
#      WORKER_SID=$OPTARG
#      ;;
#    remove ) 
#      ACTION="remove"
#      WORKER_SID=$OPTARG
#      ;;
#    * ) 
#      echo "Usage: $0 --service_sid <service_sid> --environment_sid <environment_sid> [--add <attributes> | --update <worker_id> <attributes> | --remove <worker_id>] [--file <file_path>]"
#      exit 0
#      ;;
#  esac
#done

# More portable approach:
#POSITIONAL_ARGS=()
#
#while [[ $# -gt 0 ]]; do
#  case $1 in
#    -e|--extension)
#      EXTENSION="$2"
#      shift # past argument
#      shift # past value
#      ;;
#    -s|--searchpath)
#      SEARCHPATH="$2"
#      shift # past argument
#      shift # past value
#      ;;
#    --default)
#      DEFAULT=YES
#      shift # past argument
#      ;;
#    -*|--*)
#      echo "Unknown option $1"
#      exit 1
#      ;;
#    *)
#      POSITIONAL_ARGS+=("$1") # save positional arg
#      shift # past argument
#      ;;
#  esac
#done
#
#set -- "${POSITIONAL_ARGS[@]}" # restore positional parameters


SERVICE_SID=ZS5845044ef796db5f7e53c3a7e34e43d8
ENVIRONMENT_SID=ZE7382245b8083b8dc13669e3b4e3954b0
FILE=operators.jsonl
ACTION=add

echo $SERVICE_SID
echo $ENVIRONMENT_SID

if [ -z "$SERVICE_SID" ] || [ -z "$ENVIRONMENT_SID" ];
then
  echo "Service SID and Environment SID are required."
  exit 1
fi

if [ -n "$FILE" ];
then
  WORKER_LIST=$(cat $FILE)
elif [ -n "$ATTRIBUTES" ];
then
  WORKER_LIST="$ATTRIBUTES"
fi

REGISTERED_WORKERS=`twilio api:serverless:v1:services:environments:variables:list \
    --service-sid $SERVICE_SID \
    --environment-sid $ENVIRONMENT_SID \
    | grep -i "WORKER" | awk '{ print $2,$1 }'`

echo "The operator registry contains `echo "$REGISTERED_WORKERS" | wc -l` total workers."
if [ -n "$WORKER_LIST" ];
then
      echo "Attempting to $ACTION `echo "$WORKER_LIST" | wc -l` of them."
fi

while read -r line; do
  ATTRIBUTES="$line"
  echo attributes $ATTRIBUTES
  FRIENDLY_NAME="worker$(echo $ATTRIBUTES | sed -nr "s/^.*\+1[0-9]{6}([0-9]{4}).*$/\1/p")"
  echo friendly name $FRIENDLY_NAME
  WORKER_SID=$(echo "$REGISTERED_WORKERS" | grep -i "$FRIENDLY_NAME" | awk '{ print $2 }')
  case $ACTION in
    add )
      if [ -z "$ATTRIBUTES" ]; then
        echo "Attributes are required to add a worker."
        exit 1
      fi
      echo "Adding new worker with attributes: $ATTRIBUTES"
      twilio api:serverless:v1:services:environments:variables:create \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        --key "$FRIENDLY_NAME" \
        --value "$ATTRIBUTES"
      ;;
    update )
      if [ -z "$WORKER_SID" ] || [ -z "$ATTRIBUTES" ]; then
        echo "Worker SID and Attributes are required to update a worker."
        exit 1
      fi
      echo "Updating worker $WORKER_SID with attributes: $ATTRIBUTES"
      twilio api:serverless:v1:services:environments:variables:update \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        --sid $WORKER_SID \
        --key "$FRIENDLY_NAME" \
        --value "$ATTRIBUTES"
      ;;
    remove )
      if [ -z "$WORKER_SID" ]; then
        echo "Worker SID is required to remove a worker."
        exit 1
      fi
      echo "Removing $FRIENDLY_NAME (worker sid: $WORKER_SID)"
      twilio api:serverless:v1:services:environments:variables:remove \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        --sid $WORKER_SID
      ;;
    * )
      echo $REGISTERED_WORKERS
      break
      ;;
  esac
done <<< "$WORKER_LIST"

echo "Done!"
