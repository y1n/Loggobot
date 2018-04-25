const Discord = require('discord.js')
const fs = require('fs')

const client = new Discord.Client()
let storage = require('./storage.json')

const config = require('./config.json')
if (!config) return console.error("Couldn't find config.json")

client.on('ready', () => {
    console.log('Logged in as ' + client.user.tag + '.\nI see ' + client.users.size + ' users.')

    const onion = client.guilds.find('name', 'UNION')

    if (!onion) {
        console.log("Couldn't find Onion server\nTrying to rebuild ...")

        return
    }

    //Initial Cacher
    const channels = onion.channels
        .map(c => ({
            name: c.name,
            id: c.id,
            permissionOverwrites: c.permissionOverwrites.map(o => ({
                id: o.id,
                type: o.type,
                deny: o.deny,
                allow: o.allow,
            })),
            parent: c.parentID,
            position: c.position,
        }))
        .sort((a, b) => {
            return a.position - b.position
        })

    const roles = onion.roles.map(r => ({name: r.name, id: r.id, permissions: r.permissions, position: r.position, color: r.color})).sort((a, b) => {
        return a.position - b.position
    })

    let members
    onion.fetchMembers().then(() => {
        members = onion.members.map(m => ({id: m.id, roles: m.roles.map(r => r.id)}))
        storage = {members: members, roles: roles, channels: channels}
        fs.writeFile('storage.json', JSON.stringify(storage, null, 2), () => {})
    })
})

client.login(config.token)
