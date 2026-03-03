'use strict'

let amqp

let rabbitqueue
let exchangeName
let queueName
let deliveryMode
let connExchange_
let connQueue_
let routing_

exports.register = function () {
  this.load_rabbitmq_ini()

  if (this.cfg.main.module === 'amqp') {
    exports.exchangeMapping = {}
    amqp = require('amqp')
    this.logdebug('About to connect and initialize queue object')
    this.init_rabbitmq_server()
    this.register_hook('queue', 'amqp_queue')
    this.logdebug(
      `Finished initiating : ${exports.exchangeMapping[exchangeName + queueName]}`,
    )
  } else if (this.cfg.main.module === 'amqplib') {
    amqp = require('amqplib/callback_api')
    this.init_amqp_connection()
  }
}

exports.load_rabbitmq_ini = function () {
  this.cfg = this.config.get(
    'rabbitmq.ini',
    {
      booleans: [
        '+rabbitmq.confirm',
        '+rabbitmq.durable',
        '-rabbitmq.autoDelete',
        '+amqplib.confirm',
        '+amqplib.durable',
        '-amqplib.autoDelete',
      ],
    },
    () => {
      this.load_rabbitmq_ini()
    },
  )
}

//Actual magic of publishing message to rabbit when email comes happen here.
exports.amqp_queue = function (next, connection) {
  if (!connection?.transaction) return next()

  //Calling the get_data method and when it gets the data on callback, publish the message to queue with routing key.
  connection.transaction.message_stream.get_data((buffere) => {
    const exchangeData = exports.exchangeMapping[exchangeName + queueName]
    this.logdebug(
      `Sending the data: ${queueName} Routing : ${exchangeData} exchange :${connExchange_}`,
    )
    if (connExchange_ && routing_) {
      //This is publish function of rabbitmq amqp library, currently direct queue is configured and routing is fixed.
      //Needs to be changed.
      connExchange_.publish(routing_, buffere, { deliveryMode }, (error) => {
        if (error) {
          //There was some error while sending the email to queue.
          this.logdebug('queueFailure: #{JSON.stringify(error)}')
          exports.init_rabbitmq_server()
          next()
        } else {
          //Queueing was successful, send ok as reply
          this.logdebug('queueSuccess')
          next(OK, 'Successfully Queued! in rabbitmq')
        }
      })
    } else {
      //Seems like connExchange is not defined, lets create one for next call
      exports.init_rabbitmq_server()
      next()
    }
  })
}

//This initializes the connection to rabbitmq server, It reads values from rabbitmq.ini file in config directory.
exports.init_rabbitmq_server = function () {
  // this is called during init of rabbitmq

  const confirm = this.cfg.rabbitmq?.confirm ?? true
  const durable = this.cfg.rabbitmq?.durable ?? true
  const autoDelete = this.cfg.rabbitmq?.autoDelete ?? false
  const exchangeType = this.cfg.rabbitmq?.exchangeType || 'direct'
  queueName = this.cfg.rabbitmq?.queueName || 'emails'
  exchangeName = this.cfg.rabbitmq?.exchangeName || 'emailMessages'
  deliveryMode = this.cfg.rabbitmq?.deliveryMode ?? 2

  this.logdebug('Creating connection with server')
  rabbitqueue = amqp.createConnection({
    host: this.cfg.rabbitmq.server_ip || '127.0.0.1',
    port: this.cfg.rabbitmq.server_port || '5672',
    login: this.cfg.rabbitmq.user || 'guest',
    password: this.cfg.rabbitmq.password || 'guest',
  })

  //Declaring listener on error on connection.
  rabbitqueue.on('error', (error) => {
    this.logerror(`There was some error on the connection : ${error}`)
  })

  //Declaring listerner on close on connection.
  rabbitqueue.on('close', (close) => {
    this.logdebug(` Connection  is being closed : ${close}`)
  })

  /* Declaring the function to perform when connection is established and ready, function involves like:
   *    1. Creating or connecting to Exchange.
   *  2. Creating or connecting to Queue.
   *  3. Binding the Exchange and Queue.
   *  4. Saving some variables in global to be used while publishing message.
   */

  rabbitqueue.on('ready', () => {
    this.logdebug('Connection is ready, will try making exchange')
    // Now connection is ready will try to open exchange with config data.
    rabbitqueue.exchange(
      exchangeName,
      { type: exchangeType, confirm, durable },
      (connExchange) => {
        this.logdebug(
          `connExchange with server ${connExchange} autoDelete : ${autoDelete}`,
        )

        //Exchange is now open, will try to open queue.
        return rabbitqueue.queue(
          queueName,
          { autoDelete, durable },
          (connQueue) => {
            this.logdebug(`connQueue with server ${connQueue}`)

            //Creating the Routing key to bind the queue and exchange.
            const routing = `${queueName}Routing`

            // Will try to bing queue and exchange which was created above.
            connQueue.bind(connExchange, routing)
            const key = exchangeName + queueName

            //Save the variables for publising later.
            if (!exports.exchangeMapping[key]) {
              exports.exchangeMapping[key] = []
            }
            connExchange_ = connExchange
            connQueue_ = connQueue
            routing_ = routing
            exports.exchangeMapping[key].push({
              exchange: connExchange_,
              queue: connQueue_,
              routing: routing_,
              queueName,
            })
            this.logdebug(
              `exchange: ${exchangeName}, queue: ${queueName}  exchange : ${connExchange_} queue : ${connQueue_}`,
            )
          },
        )
      },
    )
  })
}

let channel
let queue
let priority

exports.rabbitmq_queue = function (next, connection) {
  if (!connection?.transaction) return next()

  connection.transaction.message_stream.get_data((str) => {
    const sendOptions = { deliveryMode }
    if (priority != null) {
      sendOptions.priority = priority
    }
    if (channel?.sendToQueue(queue, str, sendOptions)) {
      return next(OK)
    } else {
      this.logerror('Failed to queue to rabbitmq')
      return next()
    }
  })
}

exports.init_amqp_connection = function () {
  const cfg = this.config.get('rabbitmq.ini').amqplib

  const protocol = cfg.protocol || 'amqp'
  const host = cfg.host || '127.0.0.1'
  const port = cfg.port || '5672'
  const vhost = cfg.vhost || ''
  const user = encodeURIComponent(cfg.user || 'guest')
  const password = encodeURIComponent(cfg.password || 'guest')
  const exchangeName = cfg.exchangeName || 'emailMessages'
  const exchangeType = cfg.exchangeType || 'direct'
  const queueName = cfg.queueName || 'emails'
  const durable = cfg.durable ?? true
  const autoDelete = cfg.autoDelete ?? false
  deliveryMode = cfg.deliveryMode || 2
  priority = cfg.priority

  amqp.connect(
    `${protocol}://${user}:${password}@${host}:${port}${vhost}`,
    (err, conn) => {
      if (err) {
        this.logerror(`Connection to rabbitmq failed: ${err}`)
        return
      }
      // TODO: if !confirm conn.createChannel...
      conn.createConfirmChannel((err2, ch) => {
        if (err2) {
          this.logerror(`Error creating rabbitmq channel: ${err2}`)
          return conn.close()
        }
        ch.assertExchange(
          exchangeName,
          exchangeType,
          {
            durable,
            arguments: this.cfg.exchange_args,
          },
          (err3) => {
            if (err3) {
              this.logerror(`Error asserting rabbitmq exchange: ${err3}`)
              return conn.close()
            }
            ch.assertQueue(
              queueName,
              {
                durable,
                autoDelete,
                arguments: this.cfg.amqplib_args,
              },
              (err4, ok2) => {
                if (err4) {
                  this.logerror(`Error asserting rabbitmq queue: ${err4}`)
                  return conn.close()
                }
                queue = ok2.queue
                channel = ch
                this.register_hook('queue', 'rabbitmq_queue')
              },
            )
          },
        )
      })
    },
  )
}
