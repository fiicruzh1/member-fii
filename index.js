require("dotenv").config();
const fs = require("fs");

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// ================= DATABASE =================
let db = { members: {}, cooldown: {}, panelMessageId: null };

function loadDB() {
  if (fs.existsSync("./data.json")) {
    db = JSON.parse(fs.readFileSync("./data.json"));
  }
}

function saveDB() {
  fs.writeFileSync("./data.json", JSON.stringify(db, null, 2));
}


// ================= LOG TXT (BARU) =================
async function sendLog(guild, data) {
  const ch = guild.channels.cache.get(process.env.CHANNEL_LOG);
  if (!ch) return;

  const text =
`Nama Roblox: ${data.roblox}
Nama Panggilan: ${data.nick}
Alamat: ${data.address}`;

  fs.writeFileSync("./log_member.txt", text);

  await ch.send({
    content: "📄 Log Member",
    files: ["./log_member.txt"]
  });
}

// ================= ROLE CHECK =================
function isAdmin(member) {
  const allowed = ["owner", "devbot", "dev", "admin"];
  return member.roles.cache.some(role =>
    allowed.includes(role.name.toLowerCase())
  );
}

// ================= BUTTON =================
function getButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("input_data")
      .setLabel("Input Data")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("change_name")
      .setLabel("Change Name")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("input_manual")
      .setLabel("Input Manual")
      .setStyle(ButtonStyle.Danger),

    // ===== TAMBAHAN =====
    new ButtonBuilder()
      .setCustomId("search_member")
      .setLabel("Search")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("edit_member")
      .setLabel("Edit")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ================= PANEL =================
async function sendOrUpdatePanel(guild) {
  const channel = guild.channels.cache.get(process.env.CHANNEL_MEMBER);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("📋 PANEL MEMBER FII")
    .setDescription("Gunakan tombol di bawah\n⏳ Limit 1 jam 1x")
    .setColor("Blue");

  try {
    if (db.panelMessageId) {
      const msg = await channel.messages.fetch(db.panelMessageId).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [embed],
          components: [getButtons()]
        });
        return;
      }
    }

    const newMsg = await channel.send({
      embeds: [embed],
      components: [getButtons()]
    });

    await newMsg.pin().catch(() => {});
    db.panelMessageId = newMsg.id;
    saveDB();

  } catch (err) {
    console.error(err);
  }
}

// ================= READY =================
client.on("clientReady", async () => {
  loadDB();
  console.log(`✅ Bot aktif sebagai ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (guild) await sendOrUpdatePanel(guild);
});

// ================= UPDATE LIST =================
async function updateList(guild) {
  const listChannel = guild.channels.cache.get(process.env.CHANNEL_LIST);
  if (!listChannel) return;

  let text = `# **[ ‼️ LIST MEMBER MARA SALVATRUCHA ‼️ ]**\n\n`;

  let i = 1;
  for (let id in db.members) {
    const m = db.members[id];
    text += `**${i}. ${m.roblox} [${m.nick}]**\n`;
    i++;
  }

  const messages = await listChannel.messages.fetch({ limit: 20 });
  await listChannel.bulkDelete(messages).catch(() => {});

  listChannel.send(text);
}

// ================= INTERACTION =================
client.on("interactionCreate", async (interaction) => {

  // ===== BUTTON =====
  if (interaction.isButton()) {
    const userId = interaction.user.id;
    const now = Date.now();

    // ===== SEARCH BUTTON =====
    if (interaction.customId === "search_member") {
      const modal = new ModalBuilder()
        .setCustomId("modal_search")
        .setTitle("Search Member");

      const input = new TextInputBuilder()
        .setCustomId("query")
        .setLabel("Nama Roblox / Nick")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // ===== EDIT BUTTON =====
    if (interaction.customId === "edit_member") {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: "❌ Hanya admin!",
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("modal_edit")
        .setTitle("Edit Member");

      const id = new TextInputBuilder()
        .setCustomId("id")
        .setLabel("ID Member")
        .setStyle(TextInputStyle.Short);

      const roblox = new TextInputBuilder()
        .setCustomId("roblox")
        .setLabel("Nama Roblox Baru")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(id),
        new ActionRowBuilder().addComponents(roblox)
      );

      return interaction.showModal(modal);
    }

    // 🔐 ADMIN ONLY BUTTON
    if (interaction.customId === "input_manual") {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: "❌ Hanya role owner/devbot/dev/admin yang bisa akses!",
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("modal_manual")
        .setTitle("Input Manual Admin");

      const roblox = new TextInputBuilder()
        .setCustomId("roblox")
        .setLabel("Nama Roblox")
        .setStyle(TextInputStyle.Short);

      const nick = new TextInputBuilder()
        .setCustomId("nick")
        .setLabel("Nama Panggilan")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(roblox),
        new ActionRowBuilder().addComponents(nick)
      );

      return interaction.showModal(modal);
    }

    // ⏳ COOLDOWN USER
    if (db.cooldown[userId] && now < db.cooldown[userId]) {
      const sisa = Math.floor((db.cooldown[userId] - now) / 60000);
      return interaction.reply({
        content: `⏳ Tunggu ${sisa} menit`,
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("modal_input")
      .setTitle("Input Data");

    const roblox = new TextInputBuilder()
      .setCustomId("roblox")
      .setLabel("Nama Roblox")
      .setStyle(TextInputStyle.Short);

    const nick = new TextInputBuilder()
      .setCustomId("nick")
      .setLabel("Nama Panggilan")
      .setStyle(TextInputStyle.Short);

    const address = new TextInputBuilder()
  .setCustomId("address")
  .setLabel("Alamat")
  .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(roblox),
      new ActionRowBuilder().addComponents(nick),
      new ActionRowBuilder().addComponents(address)
    );

    await interaction.showModal(modal);
  }

  // ===== MODAL =====
  if (interaction.isModalSubmit()) {

    // ===== SEARCH =====
    if (interaction.customId === "modal_search") {
      const q = interaction.fields.getTextInputValue("query").toLowerCase();

      const result = Object.entries(db.members).find(([id, m]) =>
        m.roblox.toLowerCase().includes(q) || m.nick.toLowerCase().includes(q)
      );

      return interaction.reply({
        content: result
          ? `✅ Ditemukan:\nID: ${result[0]}\n${result[1].roblox} (${result[1].nick})`
          : "❌ Tidak ditemukan",
        ephemeral: true
      });
    }

    // ===== EDIT =====
    if (interaction.customId === "modal_edit") {
      const id = interaction.fields.getTextInputValue("id");
      const roblox = interaction.fields.getTextInputValue("roblox");

      if (!db.members[id]) {
        return interaction.reply({ content: "❌ ID tidak ada", ephemeral: true });
      }

      db.members[id].roblox = roblox;
      saveDB();

      return interaction.reply({
        content: "✅ Berhasil di edit",
        ephemeral: true
      });
    }

    // 🔥 INPUT MANUAL ADMIN
    if (interaction.customId === "modal_manual") {
      const roblox = interaction.fields.getTextInputValue("roblox");
      const nick = interaction.fields.getTextInputValue("nick");

      const id = `manual_${Date.now()}`;
      db.members[id] = { roblox, nick };

      saveDB();

      await interaction.reply({
        content: `✅ Data manual ditambahkan: ${roblox} (${nick})`,
        ephemeral: true
      });

      return updateList(interaction.guild);
    }

    // 🔥 INPUT USER
    if (interaction.customId === "modal_input") {
      const userId = interaction.user.id;

      const roblox = interaction.fields.getTextInputValue("roblox");
      const nick = interaction.fields.getTextInputValue("nick");
      const address = interaction.fields.getTextInputValue("address");

      try {
        await interaction.member.setNickname(`${roblox} | ${nick}`).catch(() => {});

        db.members[userId] = { roblox, nick, address };
        db.cooldown[userId] = Date.now() + (60 * 60 * 1000);

        saveDB();

        await sendLog(interaction.guild, { roblox, nick, address });

        await interaction.reply({
          content: `✅ Berhasil!\n\n🔗 Link Jaket:\n@everyone https://www.roblox.com/catalog/96984464741235/Jaket-Quen-MS13`,
          ephemeral: true
        });

        await updateList(interaction.guild);
      } catch (err) {
        console.error(err);
      }
    }
  }
});

client.login(process.env.TOKEN);