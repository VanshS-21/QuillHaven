import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create test users
  const hashedPassword = await bcrypt.hash('password123', 12);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@quillhaven.com' },
    update: {},
    create: {
      email: 'test@quillhaven.com',
      passwordHash: hashedPassword,
      firstName: 'Test',
      lastName: 'Writer',
      subscriptionTier: 'PREMIUM',
      writingPreferences: {
        defaultGenre: 'Fantasy',
        preferredChapterLength: 3000,
        writingStyle: 'descriptive',
        aiAssistanceLevel: 'moderate',
      },
      emailVerified: new Date(),
    },
  });

  const premiumUser = await prisma.user.upsert({
    where: { email: 'premium@quillhaven.com' },
    update: {},
    create: {
      email: 'premium@quillhaven.com',
      passwordHash: hashedPassword,
      firstName: 'Premium',
      lastName: 'Author',
      subscriptionTier: 'PROFESSIONAL',
      writingPreferences: {
        defaultGenre: 'Science Fiction',
        preferredChapterLength: 4000,
        writingStyle: 'concise',
        aiAssistanceLevel: 'extensive',
      },
      emailVerified: new Date(),
    },
  });

  // Create test projects
  const fantasyProject = await prisma.project.create({
    data: {
      userId: testUser.id,
      title: 'The Chronicles of Eldoria',
      description:
        'An epic fantasy adventure following a young mage discovering their powers in a world where magic is forbidden.',
      genre: 'Fantasy',
      targetLength: 80000,
      currentWordCount: 15000,
      status: 'IN_PROGRESS',
    },
  });

  const scifiProject = await prisma.project.create({
    data: {
      userId: premiumUser.id,
      title: 'Stellar Horizons',
      description:
        "A space opera about humanity's first contact with an alien civilization.",
      genre: 'Science Fiction',
      targetLength: 100000,
      currentWordCount: 25000,
      status: 'IN_PROGRESS',
    },
  });

  // Create test characters for fantasy project
  const protagonist = await prisma.character.create({
    data: {
      projectId: fantasyProject.id,
      name: 'Aria Moonwhisper',
      description:
        'A 17-year-old girl with latent magical abilities, raised in a small village unaware of her true heritage.',
      role: 'PROTAGONIST',
      developmentArc: 'From naive village girl to powerful mage and leader',
      firstAppearance: 'Chapter 1',
    },
  });

  const mentor = await prisma.character.create({
    data: {
      projectId: fantasyProject.id,
      name: 'Master Theron',
      description:
        'An elderly wizard in hiding, former member of the disbanded Mage Council.',
      role: 'SUPPORTING',
      developmentArc: 'Reluctant mentor who learns to trust again',
      firstAppearance: 'Chapter 3',
    },
  });

  const antagonist = await prisma.character.create({
    data: {
      projectId: fantasyProject.id,
      name: 'Lord Malachar',
      description:
        'The tyrannical ruler who banned magic and hunts down remaining mages.',
      role: 'ANTAGONIST',
      developmentArc:
        'Reveals tragic backstory that explains his hatred of magic',
      firstAppearance: 'Chapter 2',
    },
  });

  // Create character relationships
  await prisma.relationship.create({
    data: {
      characterId: protagonist.id,
      relatedId: mentor.id,
      type: 'mentor-student',
      description: "Theron becomes Aria's magical teacher and father figure",
    },
  });

  await prisma.relationship.create({
    data: {
      characterId: protagonist.id,
      relatedId: antagonist.id,
      type: 'enemy',
      description:
        "Aria is the prophesied one who will challenge Malachar's rule",
    },
  });

  // Create plot threads
  const mainQuest = await prisma.plotThread.create({
    data: {
      projectId: fantasyProject.id,
      title: 'The Prophecy of the Last Mage',
      description:
        'Aria must fulfill an ancient prophecy to restore magic to the realm',
      status: 'DEVELOPING',
      relatedCharacters: {
        connect: [{ id: protagonist.id }, { id: mentor.id }],
      },
    },
  });

  const politicalIntrigue = await prisma.plotThread.create({
    data: {
      projectId: fantasyProject.id,
      title: 'The Underground Resistance',
      description:
        'A secret network of mages and sympathizers working to overthrow Malachar',
      status: 'INTRODUCED',
    },
  });

  // Create world elements
  const capitalCity = await prisma.worldElement.create({
    data: {
      projectId: fantasyProject.id,
      type: 'LOCATION',
      name: 'Drakmoor',
      description:
        "The capital city of the realm, seat of Lord Malachar's power",
      significance:
        'Central location where the final confrontation will take place',
    },
  });

  const magicSystem = await prisma.worldElement.create({
    data: {
      projectId: fantasyProject.id,
      type: 'RULE',
      name: 'Elemental Magic System',
      description:
        'Magic is drawn from the four elements: fire, water, earth, and air',
      significance: 'Defines how magic works and its limitations in this world',
    },
  });

  const ancientOrder = await prisma.worldElement.create({
    data: {
      projectId: fantasyProject.id,
      type: 'CULTURE',
      name: 'The Mage Council',
      description: 'The former governing body of mages, disbanded 20 years ago',
      significance: 'Their fall led to the current persecution of magic users',
    },
  });

  // Create world element relations
  await prisma.worldElementRelation.create({
    data: {
      elementId: capitalCity.id,
      relatedId: ancientOrder.id,
      relationType: 'historical_location',
      description: 'Drakmoor was once the seat of the Mage Council',
    },
  });

  // Create timeline events
  await prisma.timelineEvent.create({
    data: {
      projectId: fantasyProject.id,
      title: 'The Great Purge',
      description: 'Lord Malachar rises to power and bans all magic',
      eventDate: '20 years before story begins',
      importance: 5,
    },
  });

  await prisma.timelineEvent.create({
    data: {
      projectId: fantasyProject.id,
      title: "Aria's Birth",
      description: 'The prophesied child is born during a lunar eclipse',
      eventDate: '17 years before story begins',
      importance: 4,
    },
  });

  // Create sample chapters
  const chapter1 = await prisma.chapter.create({
    data: {
      projectId: fantasyProject.id,
      title: 'The Awakening',
      content: `The morning mist clung to the cobblestones of Millbrook like a shroud, and Aria Moonwhisper felt its chill seep through her worn cloak as she hurried toward the market square. At seventeen, she had grown accustomed to the early morning routine—fetch water from the well, help her grandmother with the herb garden, and then spend the day weaving baskets to sell to travelers passing through their small village.

But today felt different. The air itself seemed to hum with an energy she couldn't name, and the silver pendant her grandmother had given her on her sixteenth birthday felt warm against her chest, almost pulsing with its own heartbeat.

"Aria, child, you're dawdling again," called out Grandmother Elara from the doorway of their modest cottage. Her weathered face bore the lines of someone who had seen too much sorrow, but her eyes still held the spark of someone who remembered better times.

"Sorry, Grandmother," Aria replied, quickening her pace. But as she reached for the wooden bucket beside the well, something extraordinary happened. The water began to rise on its own, forming a perfect sphere that hovered just above the surface, catching the morning light like liquid crystal.

Aria gasped and stumbled backward, the spell—if that's what it was—breaking instantly. The water crashed back down with a splash that seemed to echo far too loudly in the quiet morning air.

"What was that?" she whispered to herself, staring at her trembling hands. Magic had been forbidden in the realm for twenty years, ever since Lord Malachar had risen to power and declared it an abomination. Those caught practicing the old arts faced imprisonment, or worse.

But there was no denying what she had just witnessed. The power that had been dormant within her for seventeen years was finally awakening, and with it came the terrifying realization that her life would never be the same.`,
      wordCount: 312,
      order: 1,
      status: 'EDITED',
    },
  });

  // Create chapter version
  await prisma.chapterVersion.create({
    data: {
      chapterId: chapter1.id,
      content: chapter1.content,
      wordCount: chapter1.wordCount,
      version: 1,
    },
  });

  const chapter2 = await prisma.chapter.create({
    data: {
      projectId: fantasyProject.id,
      title: "The Stranger's Warning",
      content: `Three days had passed since the incident at the well, and Aria had managed to convince herself it had been nothing more than a trick of the light. She threw herself into her daily tasks with renewed vigor, as if keeping busy could somehow silence the questions that plagued her thoughts.

The market day brought its usual collection of merchants and travelers, their wagons creaking under the weight of goods from distant lands. Aria was arranging her grandmother's herb bundles when a shadow fell across her stall.

"You have your mother's eyes," said a voice, deep and gravelly with age.

Aria looked up to see a tall man in a dark traveling cloak, his hood pulled low over his face. What she could see of his features spoke of someone who had lived through many winters, but his posture remained straight and strong.

"I'm sorry, sir, but I think you have me confused with someone else," Aria replied politely. "My mother died when I was very young. I don't remember her."

The stranger leaned closer, and she caught a glimpse of piercing blue eyes beneath the hood. "Lyralei Moonwhisper was one of the most gifted mages of her generation. The power that flows through your veins is her legacy, child."

Aria's blood turned to ice. "You're mistaken. There are no mages in my family. Magic is forbidden."

"Forbidden, yes. Extinct, no." The man glanced around the market square, then pressed a small wrapped bundle into her hands. "When the time comes—and it will come soon—seek out the old oak grove beyond the northern hills. Tell them Theron sent you."

Before Aria could respond, the stranger melted back into the crowd, leaving her standing there with trembling hands and a thousand new questions burning in her mind.`,
      wordCount: 298,
      order: 2,
      status: 'DRAFT',
    },
  });

  // Create sample export record
  await prisma.export.create({
    data: {
      projectId: fantasyProject.id,
      format: 'DOCX',
      filename: 'chronicles-of-eldoria-draft-v1.docx',
      fileSize: 45000,
      status: 'COMPLETED',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    },
  });

  console.log('✅ Database seeding completed successfully!');
  console.log(`👤 Created users: ${testUser.email}, ${premiumUser.email}`);
  console.log(
    `📚 Created projects: "${fantasyProject.title}", "${scifiProject.title}"`
  );
  console.log(`👥 Created ${await prisma.character.count()} characters`);
  console.log(`🧵 Created ${await prisma.plotThread.count()} plot threads`);
  console.log(`🌍 Created ${await prisma.worldElement.count()} world elements`);
  console.log(`📖 Created ${await prisma.chapter.count()} chapters`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
