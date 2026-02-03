# Hotline-lite

A simple, privacy-first Twilio-based hotline. Key features
* easy pseudononymous operator management
* multilingual support
* [ALPHA] Signal notifications

# Preparation

* Create a twilio account: https://twilio.com
  * Make a note of your twilio account SID and auth token
  * (Optional) Get a phone number: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
* Create a shift calendar for hotline operators
  * Make a note of the url to the .ics feed
  * _[Tuta](https://tuta.com/calendar) is a free, secure option if you prefer not to use Google_
* Collect the phone numbers, aliases, and working languages of your operator team

# Setup

1. Install twilio CLI: https://www.twilio.com/docs/twilio-cli/getting-started/install
2. Install github CLI: See https://github.com/cli/cli#installation
3. Clone this repo: `gh repo clone thandal/hotline-lite`
4. Run the setup script: `./setup_hotline.sh`

# Operation

## Caller Experience
When a Caller reaches the hotline, they will be greeted in various languages and asked to select their desired language by pressing a number.
They will then be placed in a wait queue while the system finds an available operator.
They will periodically hear updates while waiting.

## Operator Experience
Operators (called Workers in the Twilio task scheduling system) will receive a call from the hotline number.
They will then have the Pre-Call options to press a number to accept the Call.
If they do not, the Call will be rejected and returned to the queue to find another Operator.

Once a Caller and Operator are connected, they can talk!

When the Caller hangs up, or the Operator presses *, the Operator will have the Post-Call options to
  * Hear the Caller's number
  * Add the Caller's number to the blocklist
  * Call the Caller back

Once the Operator hangs up, the Call is completed, and the Operator may receive the next Call.

## Worker Schedule
Workers set (or are given) shifts on the hotline using a shared calendar.
Google and Tuta are two free options, but it doesn't matter what platform you use.
Workers may identify themselves using whatever name they wish, but it should correspond to a name that is linked to their number in the Worker Registry.
They do not need to list their phone number in the calendar.

Operators can sign up to be a backup operator by putting the word "backup" or "secondary" in the event location field for their shift.

Operator shift registries are stored securely in Twilio Serverless environment variables.

## Worker Registry
The setup script will help you create and update your registry of workers/operators. You can also manually manage worker registries using `./manage_worker_registry.sh`.
  * Run `./manage_worker_registry.sh --service_sid <ZSXXX> --environment_sid <ZEYYY>` to view the current worker registries
  * Add a worker registry by running `./manage_worker_registry.sh --service_sid <ZSXXX> --environment_sid <ZEYYY> --add <attributes>`
  * Update a worker registry by running `./manage_worker_registry.sh --service_sid <ZSXXX> --environment_sid <ZEYYY> --update <ZVZZZ> <attributes>`
  * Remove a worker registry by running `./manage_worker_registry.sh --service_sid <ZSXXX> --environment_sid <ZEYYY> --remove <ZVZZZ or worker_friendly_name>`
  * Process a batch action by running `./manage_worker_registry.sh --service_sid <ZSXXX> --environment_sid <ZEYYY> --remove --file <operators.jsonl>`

## Blocklist
You can manually set a blocklist, or the operators can choose to add a number to the blocklist at the end of the call
You can manage the blocklist by
  * running `./manage_blocklist.sh` to view the current state of the blocklist
  * creating a text file with a single line list of numbers, formated as +18882225555,+16663339999
  * uploading this list by running `./manage_blocklist.sh --update myfile.txt`

## Cost

The hotline has been developed by volunteers. However, it is not free to run.
Deploying and operating this hotline will cost you $1 per month + ~$0.02 per inbound minute.
These fees are managed by and payable to Twilio.

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


# To-do

 - [ ] Deliver messages left by callers to the operator group
   - The current approach integrates with Signal, via the presage-cli, and relies on access to a remote database (because twilio serverless doesn't support cloud storage). All this is more complex than we'd like!
 - [ ] Handle incoming text messages
 - [ ] Allow operators to place outbound calls? 
   - _(Perhaps limited to a directory of pre-defined contacts in order to mitigate trust and safety concerns)_
 - [ ] Create a web interface for management of the operator lists, blocklists, and other config
   - See [this example](https://github.com/twilio-labs/function-templates/tree/main/sip-quickstart) of an admin panel built on Twilio's Serverless infrastructure
 - [ ] Move [default Twilio data residency](https://www.twilio.com/docs/global-infrastructure) to the EU
