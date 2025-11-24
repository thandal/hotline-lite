# Preparation

* Create a twilio account: https://twilio.com
* Get a phone number: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming

# Setup

1. Install twilio CLI: see https://www.twilio.com/docs/twilio-cli/getting-started/install
2. Install the Serverless Toolkit
  `twilio plugins:install @twilio-labs/plugin-serverless`
3. Log in
  `twilio login`
4. Set profile
  `twilio profiles:use YOUR_PROFILE_NAME`
5. Run the setup script
  `./setup_hotline.sh`

# Operation

## Caller Experience
When a Caller reaches the hotline, they will be greeted in various languages and asked to select their desired language by pressing  a number.
They will then be placed in a wait queue while the system finds an available operator. They will periodically hear updates while waiting.

## Operator Experience
Operators (called Workers in the Twilio task scheduling system) will receive a call from the hotline number, and hear the incoming Call number.
They will then have the Pre-Call options to press a number to
  * Repeat the incoming Call number
  * Accept the Call
Or they can just hang up (or wait a few seconds) and the Call will be rejected, and returned to the queue to find another Operator.

Once a Caller and Operator are connected, they can talk!

When the Caller hangs up, or the Operator presses *, the Operator will have the Post-Call options to
  * Repeat the Call number
  * Add the Call to the Blocklist
  * Call the Caller back

Once the Operator hangs up, the Call is completed, and the Operator may receive the next Call.

## Worker Schedule
You can update available workers by
  * directly editing active_workers.jsonl, OR
  * setting up a .env file (see .env.sample)
  * running `set -a; source .env; set +a`
  * running `./calendar_to_jsonl.py`, THEN
  * running `./update_twilio_workers.sh`

You can run this in a (~hourly) loop or cron job on your local machine

## Blocklist
You can manually set a blocklist, or the operators can choose to add a number to the blocklist at the end of the call
You can manage the blocklist by
  * running `./manage_blocklist.sh` to view the current state of the blocklist
  * creating a text file with a single line list of numbers, formated as +18882225555,+16663339999
  * uploading this list by running `./manage_blocklist.sh --update myfile.txt`

# Signal Integration
  * Run `./setup_signal_presage.sh` and follow the instructions!
  * TODO: configure .env with PRESAGE_PASSPHRASE and GROUP_KEY
  * Redeploy `twilio serverless:deploy`

# Overview diagram

<img width="1426" height="859" alt="image" src="https://github.com/user-attachments/assets/34111b89-4565-4711-b548-09126cc16868" />

# Development notes for twilio-hotline

`cd twilio-hotline`

* Install Serverless Toolkit
`twilio plugins:install @twilio-labs/plugin-serverless`

* Local testing
`twilio serverless:dev`  (or :run, or :start)

* Deploy
`twilio serverless:deploy`

* List deployments (get SID from here)
`twilio serverless:list`

* LOGS (with --tail)!
`twilio serverless:logs --service-sid BLAH --tail`

Remove a service:
`twilio api:serverless:v1:services:remove --sid BLAH`

Remove a build:
`twilio api:serverless:v1:services:builds:remove --sid BLAH --service-sid BUILD_BLAH`

Remove a function:
`twilio api:serverless:v1:services:functions:remove --service-sid BLAH --sid FUNTION_BLAH`


# TODOS

 - Allow operators to place outbound calls.
 - Instructions for how to configure a github action to update worker availability.
