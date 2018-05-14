const Discord = require('discord.js')
const fs = require('fs')
const request = require('snekfetch')

const client = new Discord.Client()
let storage = require('./storage.json')

const config = require('./config.json')
if (!config) return console.error("Couldn't find config.json")

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}\nI see ${client.users.size} users.`)

    const onion = client.guilds.find('name', 'UNION')

    if (!onion) {
        console.log("Couldn't find Onion server\nTrying to rebuild ...")

        return
    }

    //Initial Cacher

    const channels = onion.channels.map(async c => ({
        name: c.name,
        id: c.id,
        type: c.type,
        permissionOverwrites: c.permissionOverwrites.map(o => ({
            name: onion.roles.get(o.id) ? onion.roles.get(o.id).name : onion.members.get(o.id).user.tag,
            id: o.id,
            deny: o.deny,
            allow: o.allow,
        })),
        parent: c.parentID,
        position: c.position,
        messages:
            c.type == 'text'
                ? (await c.fetchMessages({limit: 5}))
                      .map(m => ({
                          content: m.content,
                          avatarURL: m.author.avatarURL,
                          username: m.author.username,
                          createdAt: m.createdAt,
                      }))
                      .sort((a, b) => a.createdAt - b.createdAt)
                : null,
    }))

    const roles = onion.roles
        .map(r => ({
            name: r.name,
            id: r.id,
            permissions: r.permissions,
            position: r.position,
            color: r.color,
            mentionable: r.mentionable,
        }))
        .sort((a, b) => a.position - b.position)

    await onion.fetchMembers()
    const members = onion.members.map(m => ({
        id: m.id,
        roles: m.roles.map(r => r.id),
    }))

    const emojis = onion.emojis.map(e => ({id: e.id, name: e.name, animated: e.animated}))

    /*
    if (!fs.existsSync('./Emojis/')) {
        fs.mkdirSync('./Emojis/')
    }

    fs.readdirSync('./Emojis/').forEach(file => fs.unlinkSync('./Emojis/' + file))

    onion.emojis.forEach(emoji => {
        request.get(emoji.url).then(r => fs.writeFileSync('./Emojis/' + emoji.id + (emoji.animated ? '.gif' : '.png'), r.body))
    })
    */

    Promise.all(channels).then(channels => {
        channels.sort((a, b) => a.position - b.position)
        storage = {members: members, roles: roles, channels: channels, emojis: emojis}
        fs.writeFile('storage.json', JSON.stringify(storage, null, 2), () => {})
    })
})

client.on('message', async message => {
    if (message.content.startsWith('perm')) {
        const member = message.mentions.members.first()
        if (!member) return
        message.reply('```json\n' + JSON.stringify(member.permissions.serialize(), null, 2) + '\n```')
    }

    const newOnion = client.guilds.get('439887847357546496')
    if (config.admin.includes(message.author.id) && message.content === 'destroy') {
        newOnion.channels.forEach(async channel => {
            await channel.delete()
        })

        newOnion.roles.forEach(async role => {
            await role.delete()
        })
        return message.channel.send('Guild destroyed')
    }

    if (config.admin.includes(message.author.id) && message.content === 'addEmoji') {
        console.log('add emoji')
        storage.emojis.forEach(async emoji => {
            if (fs.existsSync('./Emojis/' + emoji.id + (emoji.animated ? '.gif' : '.png'))) {
                console.log('./Emojis/' + emoji.id + (emoji.animated ? '.gif' : '.png'), emoji.name)
                await newOnion.createEmoji('./Emojis/' + emoji.id + (emoji.animated ? '.gif' : '.png'), emoji.name)
            }
        })
    }

    if (config.admin.includes(message.author.id) && message.content === 'destroyEmoji') {
        newOnion.emojis.forEach(emoji => {
            newOnion.deleteEmoji(emoji)
        })
    }

    if (config.admin.includes(message.author.id) && message.content === 'build') {
        const start = Date.now()

        const MasterMessage = await message.channel.send('Cleaning up channels.')

        newOnion.channels.forEach(async channel => {
            await channel.delete()
        })

        MasterMessage.edit('Cleaning up roles')

        newOnion.roles.forEach(async role => {
            if (role.name == '@everyone') return
            await role.delete()
        })

        MasterMessage.edit(`Setting ${storage.roles.length} roles`)

        var editChannels = JSON.stringify(storage.channels)
        for (i = 0; i < storage.roles.length; i++) {
            let role = storage.roles[i]

            if (role.name == '@everyone') {
                newOnion.roles
                    .get(newOnion.id)
                    .setPermissions(role.permissions)
                    .catch(console.error)
                editChannels = editChannels.replace(new RegExp(role.id, 'g'), newOnion.id)
            } else {
                let newRole = await newOnion
                    .createRole({
                        name: role.name,
                        color: role.color,
                        position: role.position,
                        permissions: role.permissions,
                        mentionable: role.mentionable,
                    })
                    .catch(console.error)
                editChannels = editChannels.replace(new RegExp(role.id, 'g'), newRole.id)
            }
        }
        storage.channels = JSON.parse(editChannels)

        let categories = storage.channels.filter(c => c.type === 'category')
        let channels = storage.channels.filter(c => c.type !== 'category')

        MasterMessage.edit(`Setting ${categories.length} categories`)

        for (i = 0; i < categories.length; i++) {
            let category = categories[i]
            let newCategory = await newOnion.createChannel(category.name, category.type, category.permissionOverwrites)
            channels.forEach(channel => {
                if (channel.parent == category.id) {
                    channel.parent = newCategory.id
                }
            })
            categories[i].id = newCategory.id
        }

        MasterMessage.edit(`Setting ${channels.length} channels`)

        for (i = 0; i < channels.length; i++) {
            let channel = channels[i]
            newChannel = await newOnion.createChannel(channel.name, channel.type, channel.permissionOverwrites)
            newChannel.setParent(channel.parent)
            if (channel.type == 'text') {
                newChannel.createWebhook(channel.name + ' spammer').then(wehbook => {
                    channel.messages.forEach(
                        async message =>
                            await wehbook.send(message.content || '*probably image/file*', {
                                username: message.username,
                                avatarURL: message.avatarURL,
                            })
                    )
                })
            }
            channels[i].id = newChannel.id

            console.log(channel.permissionOverwrites.map(a => newOnion.roles.get(a.id) + ' ' + a.id))
        }

        MasterMessage.edit(`Setting Order`)

        for (i = 0; i < categories.length; i++) {
            let dataCategory = categories[i]
            let category = newOnion.channels.get(dataCategory.id)
            await category.setPosition(dataCategory.position)
        }

        for (i = 0; i < channels.length; i++) {
            let dataChannel = channels[i]
            let channel = newOnion.channels.get(dataChannel.id)
            await channel.setPosition(dataChannel.position)
        }

        MasterMessage.edit(`Server was built in ${(Date.now() - start) * 0.001} seconds`)
    }
    if (message.content == 'gibAdmin') {
        message.member.addRole(message.guild.roles.find('name', 'KIM'))
    }
})

client.login(config.token)
