const Discord = require('discord.js')
const client = new Discord.Client()

const config = require('./config.json')
if (!config) return console.error("Couldn't find config.json")

client.login(config.token)
