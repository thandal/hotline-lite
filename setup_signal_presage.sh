#!/bin/bash

echo This script will help you set up a new Signal account using presage-cli.

PRESAGE_BIN="twilio-hotline/assets/presage-cli.private.bin"
PRESAGE_DB="/tmp/presage.db.enc"
ENV_FILE="twilio-hotline/.env"

# Utility for rewriting env variables
set_env_var() {
    local key=$1
    local value=$2
    local file=$3
    echo Setting $key=$value in $file

    # create the file if it doesn't exist
    touch $file

    # Escape value for use in sed (handling / in the value)
    local escaped_value=$(echo "$value" | sed 's/\//\\\//g')

    # If the key exists, replace the entire line
    if grep -q "^${key}=" "$file"; then
        sed -i.bak "s/^${key}=.*/${key}=${escaped_value}/" "$file"
        rm "$file.bak"
    # Otherwise, append the new key-value pair
    else
        echo "${key}=${value}" >> "$file"
    fi
}

echo Loading environment variables from $ENV_FILE
source $ENV_FILE

if [ -v PRESAGE_PASSPHRASE ]; then
    echo PRESAGE_PASSPHRASE exists
else
    echo Creating a new PRESAGE_PASSPHRASE
    PRESAGE_PASSPHRASE=`uuidgen`
    set_env_var "PRESAGE_PASSPHRASE" $PRESAGE_PASSPHRASE $ENV_FILE
fi

PRESAGE_CMD="$PRESAGE_BIN --sqlite-db-path $PRESAGE_DB --passphrase $PRESAGE_PASSPHRASE"

echo Checking for a twilio phone number...
PHONE_NUMBER_SID=`twilio api:core:incoming-phone-numbers:list | tail -n 1 | awk '{ print $1 }'`
PHONE_NUMBER=`twilio api:core:incoming-phone-numbers:list | tail -n 1 | awk '{ print $2 }'`

if [ "$PHONE_NUMBER" == " " ]; then
  echo Could not find twilio phone number, exiting.
  exit
fi
echo Using $PHONE_NUMBER

# Check if we're already registered...

#./presage-cli --sqlite-db-path /tmp/presage.db.sqlite list-devices
#./presage-cli --sqlite-db-path /tmp/presage.db.sqlite retrieve-profile

SIGNAL_ACCOUNT=`$PRESAGE_CMD whoami`

if [ "$SIGNAL_ACCOUNT" != "" ]; then
    echo "You already seem to have an account set up"
    echo $SIGNAL_ACCOUNT
    echo "If you want to set up again, delete $PRESAGE_DB"
else
    # Proceed with registration!
    echo Go to https://signalcaptchas.org/registration/generate and follow the instructions to generate a signal captcha code.
    echo Once you have solved the captcha, don\'t open Signal. Right click on the "Open Signal" link and copy the link.
    read -p "Then paste the signal captcha code here and press enter:" SIGNAL_CAPTCHA
    
    echo "Go to twilio messages https://console.twilio.com/us1/monitor/logs/sms to find the confirmation code for the next step"
    $PRESAGE_CMD register --servers production --phone-number $PHONE_NUMBER --captcha $SIGNAL_CAPTCHA
    # Then have to monitor the SMS messages, and type in the confirmation code.
fi

if [ -v GROUP_KEY ]; then
    echo GROUP_KEY exists
else
    echo Now invite this number -- $PHONE_NUMBER -- to your group, and then send a message, so that we have a message to receive. You can safely re-run this script.
    # Now have to receive message *from the group* before we get the group key.
    $PRESAGE_CMD sync --stop-after-empty-queue
    # Then we can list the groups
    GROUP_KEY=`$PRESAGE_CMD list-groups | awk '{ print $1 }'`
    set_env_var "GROUP_KEY" $GROUP_KEY $ENV_FILE
fi

# Now we can send our first message!
#$PRESAGE_CMD send-to-group --master-key $GROUP_KEY --message "Test message"

if [ -v STORAGE_KEY ]; then
    echo STORAGE_KEY exists
else
    echo Creating a new STORAGE_KEY 
    STORAGE_KEY=`uuidgen`
    set_env_var "STORAGE_KEY" $STORAGE_KEY $ENV_FILE
fi

echo Uploading the encrypted db to the storageServer...
curl -k --data-binary @$PRESAGE_DB https://shen.timbrel.org:8447/upload/$STORAGE_KEY
# DEBUG fetch it back to compare...
#curl -k https://shen.timbrel.org:8447/download/$STORAGE_KEY -o presage.db.enc_down

echo All done!

