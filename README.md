[![CI Test Status][ci-img]][ci-url]
[![Code Climate][clim-img]][clim-url]

# haraka-plugin-queue-rabbitmq

Delivers mails to rabbitmq queue for further processing.

More information about rabbitmq can be found at https://www.rabbitmq.com/

## INSTALL

```sh
cd /path/to/local/haraka
npm install haraka-plugin-queue-rabbitmq
echo "queue-rabbitmq" >> config/plugins
service haraka restart
```

### Configuration

Copy the config file from the distribution into your haraka config dir and then modify it:

```sh
cp node_modules/haraka-plugin-queue-rabbitmq/config/rabbitmq.ini config/rabbitmq.ini
$EDITOR config/rabbitmq.ini
```

This plugin merges the rabbitmq and rabbitmq_ampqlib plugins. The selector is main.module and defaults to the original `rabbitmq` plugin.

This example config file provides server address and port of rabbitmq server to deliver with other configs of queues and exchange.

```ini
[main]
; module= amqp || amqplib
module=amqp

[rabbitmq]
; This is name of exchange.
exchangeName  = emailMessages
; ip and port of the server.
server_ip = localhost
server_port = 5672
; user and password
user = guest
password = guest
; name of the queue which reader will read
queueName = email
; This is for making it persistant while publishing message
deliveryMode = 2
; If true it will require ack for marking it complete from worker
confirm = true
; Again for persistance passed while creating queue
durable = true
; if true will delete queue if publisher quits
autoDelete = false
; type of the exchange
exchangeType = direct


[amqplib]
; Connection
; Protocol. Either "amqp" or "amqps"
protocol = amqp
host = localhost
port = 5672
;Virtual Host. Start with "/". Leave blank or not use if you don't want to use virtual hosts.
vhost = /haraka
;Credentials
user = guest
password = guest
; Exchange
exchangeName  = email_messages
exchangeType = direct
; Queue
queueName = emails
confirm = true
durable = true
autoDelete = false
; Message
deliveryMode = 2
priority = 1

; Optional exchange arguments
; More information about exchange x-arguments can be found at https://www.rabbitmq.com/docs/exchanges#optional-arguments
[exchange_args]
alternate-exchange =

; Optional queue arguments
; More information about queue x-arguments can be found at https://www.rabbitmq.com/queues.html#optional-arguments
[queue_args]
x-dead-letter-exchange =
x-dead-letter-routing-key = emails_dlq
x-overflow = reject-publish
x-queue-type = quorum
```

## USAGE

<!-- leave these buried at the bottom of the document -->

[ci-img]: https://github.com/haraka/haraka-plugin-queue-rabbitmq/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/haraka/haraka-plugin-queue-rabbitmq/actions/workflows/ci.yml
[clim-img]: https://codeclimate.com/github/haraka/haraka-plugin-queue-rabbitmq/badges/gpa.svg
[clim-url]: https://codeclimate.com/github/haraka/haraka-plugin-queue-rabbitmq
