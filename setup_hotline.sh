#!/bin/bash

# Phone numbers can be found at https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
# Services can be found at https://console.twilio.com/us1/develop/functions/services
# Workspaces can be found at https://console.twilio.com/us1/develop/taskrouter/workspaces

SERVICE_FRIENDLY_NAME=twilio-hotline
WORKSPACE_FRIENDLY_NAME=twilio-workspace
ENV_FILE="twilio-hotline/.env"

# Idempotently set KEY="value" in the .env file, replacing any existing line for
# KEY and leaving everything else in place (including any other secrets already
# in the file). Writes through the .env symlink so the DEV/PROD profiles set up
# by switch_profile.sh stay intact.
set_env_var() {
    local key=$1 value=$2 body
    touch "$ENV_FILE"
    body=$(grep -v "^${key}=" "$ENV_FILE")
    { [[ -n "$body" ]] && printf '%s\n' "$body"; printf '%s="%s"\n' "$key" "$value"; } > "$ENV_FILE"
}

if [[ `twilio plugins | grep "plugin-serverless"` == "" ]]
then
    echo "Installing Twilio Serverless plugin..."
    twilio plugins:install @twilio-labs/plugin-serverless
fi

if [[ `twilio profiles:list | grep "AC[0-9a-fA-F]\{32\}"` == "" ]]
then
    twilio login
else
    twilio profiles:list
fi

read -p "Enter the shorthand identifier of your Twilio CLI profile (or press enter to use a new profile): " PROFILE_NAME

if [[ -z "$PROFILE_NAME" ]]
then
    twilio login
    PROFILE_NAME=`twilio profiles:list | tail -n 1 | awk '{ print $1 }'`
fi
twilio profiles:use $PROFILE_NAME

echo Checking for a twilio phone number...
PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:list \
    | tail -n 1 | awk '{ print $1 }'`
PHONE_NUMBER=`twilio api:core:incoming-phone-numbers:list \
    | tail -n 1 | awk '{ print $2 }'`
if [[ "$PHONE_NUMBER_SID" ]]
then
    read -p "Do you want to use `twilio api:core:incoming-phone-numbers:list | tail -n 1 | awk '{print $3 " " $4}'` for the hotline? (y/n) " -n 1 -r REPLY
    echo    # (optional) move to a new line
    echo    # (optional) move to a new line
fi

if [[ -z "$PHONE_NUMBER_SID" || ! $REPLY =~ ^[Yy]$ ]]
then
    echo "This account owns the following phone numbers:"
    twilio api:core:incoming-phone-numbers:list
    read -p "Enter the phone number in E.164 format (e.g. +15405340500) that you want to use or press enter to find a new number: " PHONE_NUMBER
    PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:list \
        --phone-number $PHONE_NUMBER \
        | tail -n 1 | awk '{ print $1 }'`
    if [ -z "$PHONE_NUMBER_SID" ]
    then
        read -p "Enter the area code you want (e.g. 202): " AREA_CODE
        echo "Here are a list of available phone numbers with area code $AREA_CODE:"
        twilio api:core:available-phone-numbers:local:list \
            --country-code US \
            --area-code $AREA_CODE \
            --contains 00$ 
        read -p "Enter the phone number you want in E.164 format (e.g. +15405340500): " PHONE_NUMBER
        PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:create \
            --phone-number $PHONE_NUMBER \
            --properties sid \
            | tail -n 1 | awk '{ print $1 }'`
        if [ -z "$PHONE_NUMBER_SID" ]
        then
            echo "Could not buy phone number $PHONE_NUMBER. Please try again or buy a phone number at https://console.twilio.com."
            exit 1
        fi
    fi
fi

set_env_var "HOTLINE_PHONE_NUMBER" "$PHONE_NUMBER"
echo "Using $PHONE_NUMBER"

echo Initially deploying service...
(cd twilio-hotline; twilio serverless:deploy)

#echo SERVICE friendly name: $SERVICE_FRIENDLY_NAME
SERVICE_SID=`twilio api:serverless:v1:services:list | grep " $SERVICE_FRIENDLY_NAME " | awk '{ print $1 }'`
if [ ${#SERVICE_SID} != 34 ]
then
    echo "Service SID not found"
    exit
fi
#echo Service SID: $SERVICE_SID

# Find the environment
ENVIRONMENT_SID=`twilio api:serverless:v1:services:environments:list \
    --service-sid $SERVICE_SID \
    | grep "dev-environment" | awk '{ print $1 }'`
if [ ${#ENVIRONMENT_SID} != 34 ]
then
    echo "Environment SID not found"
    exit
fi
#echo Environment SID: $ENVIRONMENT_SID

# Languages, operators, the shift calendar, the blocklist, and special call
# handling are all configured from the admin dashboard (/admin.html) after deploy,
# so setup no longer prompts for them. hotline.protected.js falls back to a
# default language list until an admin sets one.

# Find the service domain base for callback functions
SERVICE_DOMAIN_BASE=`twilio api:serverless:v1:services:list \
    --properties="sid,friendlyName,domainBase" \
    | grep " $SERVICE_FRIENDLY_NAME " | awk '{ print $3 }' `
#echo Service domain base: $SERVICE_DOMAIN_BASE

#echo WORKSPACE friendly name: $WORKSPACE_FRIENDLY_NAME

# Check for an existing workspace
WORKSPACE_SID=`twilio api:taskrouter:v1:workspaces:list \
    --friendly-name $WORKSPACE_FRIENDLY_NAME \
    --properties sid \
    | tail -n 1`
if [ ${#WORKSPACE_SID} != 34 ]
then
    # Create a new workspace
    WORKSPACE_SID=`twilio api:taskrouter:v1:workspaces:create \
        --friendly-name $WORKSPACE_FRIENDLY_NAME \
        --template FIFO \
        --properties sid \
        | tail -n 1`
fi
if [ ${#WORKSPACE_SID} != 34 ]
then
    echo "Workspace SID not found"
    exit
fi
set_env_var "WORKSPACE_SID" "$WORKSPACE_SID"
#echo Workspace SID: $WORKSPACE_SID

WORKFLOW_SID=`twilio api:taskrouter:v1:workspaces:workflows:list \
    --workspace-sid $WORKSPACE_SID \
    | tail -n 1 | awk '{ print $1 }'`
set_env_var "WORKFLOW_SID" "$WORKFLOW_SID"
#echo Workflow SID: $WORKFLOW_SID

QUEUE_SID=`twilio api:taskrouter:v1:workspaces:task-queues:list \
    --workspace-sid $WORKSPACE_SID \
    | tail -n 1 | awk '{ print $1 }'`
#echo Queue SID: $QUEUE_SID

# Configure the workspace workflow (assignment-callback-url is a little brittle!)
# Most phones go to voicemail after 20 seconds, so we set the task reservation timeout to avoid that.
echo  # (optional) move to a new line
echo "Configuring the workflow..."
WORKFLOW_CONFIGURATION=`cat workflow.json | jq -rca . | sed s/QUEUE_SID/$QUEUE_SID/g`
twilio api:taskrouter:v1:workspaces:workflows:update \
    --workspace-sid $WORKSPACE_SID \
    --sid $WORKFLOW_SID \
    --assignment-callback-url="https://$SERVICE_DOMAIN_BASE-dev.twil.io/queue/assignment" \
    --task-reservation-timeout 20 \
    --configuration "$WORKFLOW_CONFIGURATION"

echo  # (optional) move to a new line
echo "Configuring the task queue..."
twilio api:taskrouter:v1:workspaces:task-queues:update \
    --workspace-sid $WORKSPACE_SID \
    --sid $QUEUE_SID \
    --max-reserved-workers=50

# Set the admin panel password (used by functions/admin.js for /admin.html login)
echo  # (optional) move to a new line
echo "Configuring the admin panel password..."
ADMIN_PASSWORD_SID=`twilio api:serverless:v1:services:environments:variables:list \
    --service-sid $SERVICE_SID \
    --environment-sid $ENVIRONMENT_SID \
    | grep "ADMIN_PASSWORD" | awk '{ print $1 }'`
if [ ${#ADMIN_PASSWORD_SID} == 34 ]
then
    # Already configured: press enter to keep the current password, or type a new one to replace it.
    read -s -p "An admin password is already set. Enter a new one to replace it, or press enter to keep the current one: " ADMIN_PASSWORD
    echo    # (optional) move to a new line
    if [[ -n "$ADMIN_PASSWORD" ]]
    then
        twilio api:serverless:v1:services:environments:variables:update \
            --service-sid $SERVICE_SID \
            --environment-sid $ENVIRONMENT_SID \
            --sid $ADMIN_PASSWORD_SID \
            --key "ADMIN_PASSWORD" \
            --value "$ADMIN_PASSWORD" > /dev/null
        echo "Admin password updated."
    else
        echo "Keeping the existing admin password."
    fi
else
    # Not configured yet: require a non-empty password.
    ADMIN_PASSWORD=""
    while [[ -z "$ADMIN_PASSWORD" ]]
    do
        read -s -p "Enter a password for the hotline admin panel: " ADMIN_PASSWORD
        echo    # (optional) move to a new line
        if [[ -z "$ADMIN_PASSWORD" ]]
        then
            echo "Password cannot be empty. Please try again."
        fi
    done
    ADMIN_PASSWORD_SID=`twilio api:serverless:v1:services:environments:variables:create \
        --service-sid $SERVICE_SID \
        --environment-sid $ENVIRONMENT_SID \
        --key "ADMIN_PASSWORD" \
        --value "$ADMIN_PASSWORD" \
        | tail -n 1 | awk '{ print $1 }'`
    echo "Admin password set."
fi
#echo Admin password SID: $ADMIN_PASSWORD_SID

# Deploy the service again to pick up any changes to environment variables
echo "Re-deploying the service with configuration..."
(cd twilio-hotline; twilio serverless:deploy)

# Configure the phone number
echo  # (optional) move to a new line
echo "Configuring the phone number callbacks..."
APPLICATION_SID=`twilio api:core:applications:list \
    | grep "$SERVICE_FRIENDLY_NAME" | awk '{ print $1 }'`
if [ ${#APPLICATION_SID} == 34 ]
then
    twilio api:core:applications:update \
        --sid $APPLICATION_SID \
        --voice-method POST \
        --sms-method POST \
        --voice-url https://$SERVICE_DOMAIN_BASE-dev.twil.io/hotline \
        --sms-url https://$SERVICE_DOMAIN_BASE-dev.twil.io/inboundMessage \
        --status-callback https://$SERVICE_DOMAIN_BASE-dev.twil.io/clearLogs
else
    APPLICATION_SID=`twilio api:core:applications:create \
        --friendly-name $SERVICE_FRIENDLY_NAME \
        --voice-method POST \
        --sms-method POST \
        --voice-url https://$SERVICE_DOMAIN_BASE-dev.twil.io/hotline \
        --sms-url https://$SERVICE_DOMAIN_BASE-dev.twil.io/inboundMessage \
        --status-callback https://$SERVICE_DOMAIN_BASE-dev.twil.io/clearLogs \
        | tail -n 1 | awk '{ print $1 }'`
fi
set_env_var "APPLICATION_SID" "$APPLICATION_SID"

twilio api:core:incoming-phone-numbers:update \
    --sid $PHONE_NUMBER_SID \
    --voice-application-sid=$APPLICATION_SID \
    --sms-application-sid=$APPLICATION_SID

echo  # (optional) move to a new line
echo "Done!"
echo
echo "Manage operators, languages, the blocklist, the shift calendar,"
echo "and special call handling from the admin dashboard:"
echo "  https://$SERVICE_DOMAIN_BASE-dev.twil.io/admin.html"