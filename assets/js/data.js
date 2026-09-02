/* ===== iThrive — Seed data for Northbeam Technologies ===== */
(function (g) {
  const NOW = Date.now();
  const t = (min) => new Date(NOW - min * 60000).toISOString();
  const fwd = (min) => new Date(NOW + min * 60000).toISOString();
  const H = 60, D = 1440;

  /* ------------------------------------------------------------------ */
  /* Organization & workspaces                                          */
  /* ------------------------------------------------------------------ */
  const ORG = {
    id: 'org_northbeam',
    name: 'Northbeam Technologies',
    short: 'NB',
    domain: 'northbeam.io',
    plan: 'Enterprise',
    seats: 600,
    employees: 486,
    founded: 2016,
    hq: 'Lisbon, Portugal',
    color: 'linear-gradient(135deg,#12a583,#0b6e59)',
    tagline: 'Fleet intelligence software for modern logistics.',
    storageUsed: 742 * 1073741824,
    storageTotal: 2048 * 1073741824,
    ownerId: 'p2',
    createdAt: '2016-04-11',
    retentionDays: 730,
    verified: true
  };

  const WORKSPACES = [
    { id: 'org_northbeam', name: 'Northbeam Technologies', short: 'NB', plan: 'Enterprise', color: 'linear-gradient(135deg,#12a583,#0b6e59)', unread: 14, role: 'Admin', members: 486 },
    { id: 'org_helio', name: 'Helio Design Studio', short: 'HD', plan: 'Business', color: 'linear-gradient(135deg,#7c5cff,#5330c0)', unread: 3, role: 'Guest', members: 24 },
    { id: 'org_meridian', name: 'Meridian Partners', short: 'MP', plan: 'Business', color: 'linear-gradient(135deg,#ff7a45,#c2451a)', unread: 0, role: 'External Collaborator', members: 61 }
  ];

  const DEPARTMENTS = [
    { id: 'engineering', name: 'Engineering', icon: 'code', color: '#2e7cf6', headId: 'p3', headcount: 168, budget: 'Tracking 96% of plan' },
    { id: 'design', name: 'Design', icon: 'palette', color: '#d946ef', headId: 'p4', headcount: 34, budget: 'Tracking 88% of plan' },
    { id: 'product', name: 'Product', icon: 'target', color: '#12a583', headId: 'p6', headcount: 29, budget: 'Tracking 91% of plan' },
    { id: 'marketing', name: 'Marketing', icon: 'megaphone', color: '#ff7a45', headId: 'p28', headcount: 41, budget: 'Tracking 103% of plan' },
    { id: 'sales', name: 'Sales', icon: 'trendingUp', color: '#eab308', headId: 'p5', headcount: 78, budget: 'Tracking 112% of plan' },
    { id: 'success', name: 'Customer Success', icon: 'lifeBuoy', color: '#0ea5b7', headId: 'p36', headcount: 52, budget: 'Tracking 94% of plan' },
    { id: 'people', name: 'People & Culture', icon: 'users', color: '#8b5cf6', headId: 'p8', headcount: 18, budget: 'Tracking 87% of plan' },
    { id: 'finance', name: 'Finance', icon: 'dollar', color: '#17a34a', headId: 'p7', headcount: 21, budget: 'Tracking 92% of plan' },
    { id: 'legal', name: 'Legal & Compliance', icon: 'scale', color: '#64748b', headId: 'p42', headcount: 9, budget: 'Tracking 90% of plan' },
    { id: 'it', name: 'IT & Security', icon: 'shield', color: '#e5484d', headId: 'p43', headcount: 26, budget: 'Tracking 99% of plan' },
    { id: 'ops', name: 'Operations', icon: 'briefcase', color: '#0b6e59', headId: 'p44', headcount: 20, budget: 'Tracking 95% of plan' }
  ];

  const TEAMS = [
    { id: 'tm-core', name: 'Core Platform', deptId: 'engineering', leadId: 'p13' },
    { id: 'tm-fleet', name: 'Fleet Intelligence', deptId: 'engineering', leadId: 'p10' },
    { id: 'tm-mobile', name: 'Mobile', deptId: 'engineering', leadId: 'p16' },
    { id: 'tm-quality', name: 'Quality Engineering', deptId: 'engineering', leadId: 'p19' },
    { id: 'tm-productdesign', name: 'Product Design', deptId: 'design', leadId: 'p21' },
    { id: 'tm-brand', name: 'Brand Studio', deptId: 'design', leadId: 'p24' },
    { id: 'tm-pm', name: 'Product Management', deptId: 'product', leadId: 'p6' },
    { id: 'tm-growth', name: 'Growth', deptId: 'marketing', leadId: 'p30' },
    { id: 'tm-enterprise', name: 'Enterprise Sales', deptId: 'sales', leadId: 'p5' },
    { id: 'tm-support', name: 'Support', deptId: 'success', leadId: 'p38' }
  ];

  /* ------------------------------------------------------------------ */
  /* People                                                             */
  /* id, name, title, dept, team, manager, location, tz, presence, statusText, emoji, skills, role, joined */
  /* ------------------------------------------------------------------ */
  const RAW_PEOPLE = [
    ['p1','Aarav Menon','Senior Product Manager','product','tm-pm','p6','Bengaluru, India','IST (GMT+5:30)','available','Shipping Apollo v2','🚀',['Roadmapping','Discovery','Analytics','Pricing'],'Admin','2021-03-15'],
    ['p2','Elena Vasquez','Chief Executive Officer','ops',null,null,'Lisbon, Portugal','WET (GMT+0)','meeting','Board offsite until Thursday','📊',['Strategy','Fundraising','Operating'],'Owner','2016-04-11'],
    ['p3','Marcus Bell','VP of Engineering','engineering',null,'p2','Austin, TX, USA','CST (GMT-6)','busy','Deep work — async replies','🎧',['Architecture','Scaling','Leadership'],'Super Admin','2017-01-09'],
    ['p4','Sofia Lindqvist','VP of Design','design',null,'p2','Stockholm, Sweden','CET (GMT+1)','available','','',['Design systems','Craft','Hiring'],'Super Admin','2018-06-04'],
    ['p5','David Okonkwo','VP of Sales','sales','tm-enterprise','p2','London, UK','GMT (GMT+0)','meeting','Customer QBR','🤝',['Enterprise','Forecasting','Negotiation'],'Admin','2018-02-19'],
    ['p6','Rachel Kim','VP of Product','product','tm-pm','p2','San Francisco, CA, USA','PST (GMT-8)','available','','',['Strategy','Discovery','Positioning'],'Super Admin','2017-08-21'],
    ['p7','Thomas Grant','Chief Financial Officer','finance',null,'p2','New York, NY, USA','EST (GMT-5)','away','Back at 3','⏰',['FP&A','Reporting','Compliance'],'Admin','2019-05-13'],
    ['p8','Nadia Haddad','Chief People Officer','people',null,'p2','Lisbon, Portugal','WET (GMT+0)','available','Open for 1:1s','☕',['Culture','Talent','Comp'],'Admin','2019-09-02'],
    ['p10','Priya Raghunathan','Principal Engineer','engineering','tm-fleet','p3','Bengaluru, India','IST (GMT+5:30)','available','Reviewing the routing RFC','🔍',['Distributed systems','Go','Kafka','Postgres'],'Employee','2018-11-05'],
    ['p11','Lucas Moreau','Staff Backend Engineer','engineering','tm-fleet','p10','Paris, France','CET (GMT+1)','available','','',['Go','gRPC','Event sourcing'],'Employee','2019-03-18'],
    ['p12','Chen Wei','Senior Frontend Engineer','engineering','tm-fleet','p10','Singapore','SGT (GMT+8)','offline','','',['TypeScript','React','Performance'],'Employee','2020-07-27'],
    ['p13','Amara Okafor','Engineering Manager, Core Platform','engineering','tm-core','p3','Lagos, Nigeria','WAT (GMT+1)','available','','',['Platform','Reliability','Coaching'],'Manager','2019-10-14'],
    ['p14','Jonas Berg','Senior Site Reliability Engineer','engineering','tm-core','p13','Oslo, Norway','CET (GMT+1)','busy','On call — page me for P1','📟',['Kubernetes','Terraform','Observability'],'Employee','2020-01-20'],
    ['p15','Meera Iyer','Backend Engineer','engineering','tm-core','p13','Bengaluru, India','IST (GMT+5:30)','available','','',['Python','Postgres','APIs'],'Employee','2022-02-07'],
    ['p16','Tom Whitfield','Mobile Engineering Lead','engineering','tm-mobile','p3','Manchester, UK','GMT (GMT+0)','meeting','','',['Kotlin','Swift','Release engineering'],'Team Lead','2019-06-11'],
    ['p17','Yuki Tanaka','Senior iOS Engineer','engineering','tm-mobile','p16','Tokyo, Japan','JST (GMT+9)','offline','Signing off — 11pm here','🌙',['Swift','SwiftUI','Offline sync'],'Employee','2021-04-05'],
    ['p18','Diego Ramirez','Android Engineer','engineering','tm-mobile','p16','Mexico City, Mexico','CST (GMT-6)','available','','',['Kotlin','Compose','Maps SDK'],'Employee','2021-09-13'],
    ['p19','Hannah Brooks','QA Lead','engineering','tm-quality','p3','Dublin, Ireland','GMT (GMT+0)','available','Regression run in progress','🧪',['Automation','Playwright','Release QA'],'Team Lead','2020-05-04'],
    ['p20','Oliver Schmidt','Senior Data Engineer','engineering','tm-core','p13','Berlin, Germany','CET (GMT+1)','available','','',['dbt','Snowflake','Airflow'],'Employee','2020-11-16'],
    ['p21','Zara Ahmed','Lead Product Designer','design','tm-productdesign','p4','Toronto, Canada','EST (GMT-5)','available','Prototyping the new dispatch board','🎨',['Interaction','Prototyping','Design systems'],'Team Lead','2019-08-12'],
    ['p22','Noah Fitzgerald','Senior Product Designer','design','tm-productdesign','p21','Melbourne, Australia','AEDT (GMT+11)','offline','','',['UI','Motion','Accessibility'],'Employee','2021-01-25'],
    ['p23','Ines Duarte','UX Researcher','design','tm-productdesign','p4','Lisbon, Portugal','WET (GMT+0)','available','5 dispatcher interviews this week','🎙️',['Research ops','Interviews','Synthesis'],'Employee','2021-11-08'],
    ['p24','Kofi Mensah','Brand Design Lead','design','tm-brand','p4','Accra, Ghana','GMT (GMT+0)','available','','',['Brand','Illustration','Motion'],'Team Lead','2020-03-02'],
    ['p25','Julia Sorensen','Product Manager, Core Platform','product','tm-pm','p6','Copenhagen, Denmark','CET (GMT+1)','available','','',['Platform','APIs','Enablement'],'Employee','2020-09-21'],
    ['p26','Ravi Nair','Technical Product Manager','product','tm-pm','p6','Bengaluru, India','IST (GMT+5:30)','busy','Heads-down on the integrations spec','📝',['APIs','Integrations','Specs'],'Employee','2021-06-14'],
    ['p27','Grace Liu','Product Analyst','product','tm-pm','p6','Vancouver, Canada','PST (GMT-8)','available','','',['SQL','Experimentation','Dashboards'],'Employee','2022-04-18'],
    ['p28','Camille Rousseau','Head of Marketing','marketing',null,'p2','Paris, France','CET (GMT+1)','available','Launch week!','📣',['Positioning','Campaigns','PR'],'Manager','2019-02-11'],
    ['p29','Ethan Cole','Content Lead','marketing','tm-growth','p28','Denver, CO, USA','MST (GMT-7)','available','','',['Editorial','SEO','Storytelling'],'Employee','2021-07-19'],
    ['p30','Aisha Bello','Growth Marketing Manager','marketing','tm-growth','p28','Lagos, Nigeria','WAT (GMT+1)','available','','',['Lifecycle','Paid','Analytics'],'Team Lead','2021-02-08'],
    ['p31','Pablo Ortega','Marketing Operations Manager','marketing','tm-growth','p28','Madrid, Spain','CET (GMT+1)','away','Lunch','🥪',['Martech','Attribution','Automation'],'Employee','2022-01-10'],
    ['p32','Sarah Donnelly','Enterprise Account Executive','sales','tm-enterprise','p5','Chicago, IL, USA','CST (GMT-6)','busy','On a call with Vantage Freight','📞',['Enterprise','MEDDIC','Renewals'],'Employee','2020-02-24'],
    ['p33','Michael Chen','Principal Sales Engineer','sales','tm-enterprise','p5','Seattle, WA, USA','PST (GMT-8)','available','','',['Demos','Solutioning','Security reviews'],'Employee','2020-08-03'],
    ['p34','Fatima Al-Rashid','SDR Manager','sales','tm-enterprise','p5','Dubai, UAE','GST (GMT+4)','available','','',['Outbound','Coaching','Pipeline'],'Manager','2021-05-17'],
    ['p35','Ben Carter','Account Executive','sales','tm-enterprise','p5','Manchester, UK','GMT (GMT+0)','meeting','','',['Mid-market','Discovery'],'Employee','2022-03-14'],
    ['p36','Laura Fernandez','Head of Customer Success','success',null,'p2','Barcelona, Spain','CET (GMT+1)','available','','',['Retention','Onboarding','Advocacy'],'Manager','2019-04-08'],
    ['p37','Sam Patel','Customer Success Manager','success','tm-support','p36','Toronto, Canada','EST (GMT-5)','available','','',['Onboarding','QBRs','Adoption'],'Employee','2021-10-04'],
    ['p38','Nora Lindgren','Support Lead','success','tm-support','p36','Stockholm, Sweden','CET (GMT+1)','busy','Triaging the escalation queue','🚨',['Escalations','Docs','Tooling'],'Team Lead','2020-06-22'],
    ['p39','Daniel Osei','Senior Talent Partner','people',null,'p8','Accra, Ghana','GMT (GMT+0)','available','','',['Recruiting','Employer brand'],'Employee','2021-03-29'],
    ['p40','Emily Zhang','People Operations Specialist','people',null,'p8','Lisbon, Portugal','WET (GMT+0)','available','Benefits enrolment open','📋',['HRIS','Onboarding','Policy'],'Employee','2022-05-30'],
    ['p41','Victor Almeida','Senior Financial Analyst','finance',null,'p7','Lisbon, Portugal','WET (GMT+0)','available','','',['FP&A','Modelling','Revenue ops'],'Employee','2021-08-16'],
    ['p42','Anna Kowalski','Senior Legal Counsel','legal',null,'p2','Warsaw, Poland','CET (GMT+1)','dnd','In contract review — do not disturb','⚖️',['Contracts','Privacy','DPAs'],'Manager','2020-10-12'],
    ['p43','Hassan Yildiz','Head of IT & Security','it',null,'p2','Istanbul, Türkiye','TRT (GMT+3)','available','','',['SecOps','Zero trust','Compliance'],'Super Admin','2019-12-02'],
    ['p44','Rosa Martinez','Workplace Operations Manager','ops',null,'p8','Lisbon, Portugal','WET (GMT+0)','available','','',['Facilities','Events','Vendors'],'Manager','2020-04-27'],
    ['p45','Tobias Krüger','Data Analyst','finance',null,'p7','Berlin, Germany','CET (GMT+1)','available','','',['SQL','Looker','Forecasting'],'Employee','2022-07-11'],
    ['p46','Claire Dubois','Design Partner — Helio Studio','design',null,null,'Lyon, France','CET (GMT+1)','available','Guest access until Mar 31','🔗',['Illustration','Brand'],'Guest','2025-11-03'],
    ['p47','Ryan Novak','Solutions Consultant — Meridian','ops',null,null,'Prague, Czechia','CET (GMT+1)','offline','','',['Integrations','Migration'],'External Collaborator','2025-12-15']
  ];

  const PEOPLE = RAW_PEOPLE.map(function (r) {
    const first = r[1].split(' ')[0], last = r[1].split(' ').slice(1).join(' ');
    return {
      id: r[0], name: r[1], first: first, last: last,
      email: (first + '.' + last).toLowerCase().replace(/[^a-z.]/g, '') + '@northbeam.io',
      phone: '+351 21 ' + (400 + (parseInt(r[0].slice(1), 10) * 7) % 500) + ' ' + (1000 + (parseInt(r[0].slice(1), 10) * 137) % 8999),
      title: r[2], deptId: r[3], teamId: r[4], managerId: r[5],
      location: r[6], tz: r[7], presence: r[8], statusText: r[9], statusEmoji: r[10],
      skills: r[11], role: r[12], joined: r[13],
      pronouns: '', workingHours: '09:00 – 18:00'
    };
  });
  const PMAP = {}; PEOPLE.forEach(p => PMAP[p.id] = p);
  const ME = 'p1';

  const ids = (...a) => a;
  const engIds = PEOPLE.filter(p => p.deptId === 'engineering').map(p => p.id);
  const desIds = PEOPLE.filter(p => p.deptId === 'design').map(p => p.id);
  const proIds = PEOPLE.filter(p => p.deptId === 'product').map(p => p.id);
  const mktIds = PEOPLE.filter(p => p.deptId === 'marketing').map(p => p.id);
  const salIds = PEOPLE.filter(p => p.deptId === 'sales').map(p => p.id);
  const allIds = PEOPLE.map(p => p.id);

  /* ------------------------------------------------------------------ */
  /* Channels                                                           */
  /* ------------------------------------------------------------------ */
  const CHANNELS = [
    { id: 'c-general', name: 'general', type: 'public', topic: 'Company-wide chatter, wins and questions', purpose: 'Everyone at Northbeam is here.', memberIds: allIds, adminIds: ['p8','p2'], createdBy: 'p2', createdAt: '2016-04-12', favorite: true, muted: false, archived: false },
    { id: 'c-announcements', name: 'announcements', type: 'announcement', topic: 'Official company announcements — read only', purpose: 'Only admins and managers can post.', memberIds: allIds, adminIds: ['p2','p8'], createdBy: 'p2', createdAt: '2016-04-12', favorite: true, muted: false, archived: false, readOnly: true },
    { id: 'c-engineering', name: 'engineering', type: 'department', deptId: 'engineering', topic: 'Engineering-wide discussion', purpose: 'Architecture, reviews, incidents and shipping.', memberIds: engIds.concat(['p1','p6','p25','p26','p19']), adminIds: ['p3'], createdBy: 'p3', createdAt: '2017-01-15', favorite: true, muted: false, archived: false },
    { id: 'c-design', name: 'design', type: 'department', deptId: 'design', topic: 'Design crits, explorations, systems', purpose: 'Where design work happens in the open.', memberIds: desIds.concat(['p1','p6','p21','p25','p22']), adminIds: ['p4'], createdBy: 'p4', createdAt: '2018-06-06', favorite: true, muted: false, archived: false },
    { id: 'c-product', name: 'product', type: 'department', deptId: 'product', topic: 'Roadmap, discovery and specs', purpose: '', memberIds: proIds.concat(['p3','p4','p21','p10','p28']), adminIds: ['p6'], createdBy: 'p6', createdAt: '2017-09-01', favorite: false, muted: false, archived: false },
    { id: 'c-marketing', name: 'marketing', type: 'department', deptId: 'marketing', topic: 'Campaigns, content and comms', purpose: '', memberIds: mktIds.concat(['p1','p6','p24','p5']), adminIds: ['p28'], createdBy: 'p28', createdAt: '2019-02-14', favorite: false, muted: false, archived: false },
    { id: 'c-sales', name: 'sales', type: 'department', deptId: 'sales', topic: 'Pipeline, deals and enablement', purpose: '', memberIds: salIds.concat(['p6','p36','p33','p1']), adminIds: ['p5'], createdBy: 'p5', createdAt: '2018-02-20', favorite: false, muted: false, archived: false },
    { id: 'c-people-ops', name: 'people-ops', type: 'department', deptId: 'people', topic: 'Benefits, policies and people programmes', purpose: '', memberIds: allIds, adminIds: ['p8'], createdBy: 'p8', createdAt: '2019-09-04', favorite: false, muted: false, archived: false },
    { id: 'c-finance', name: 'finance-private', type: 'private', deptId: 'finance', topic: 'Budget and forecast — restricted', purpose: 'Finance leadership only.', memberIds: ['p7','p41','p45','p2','p1'], adminIds: ['p7'], createdBy: 'p7', createdAt: '2019-05-20', favorite: false, muted: false, archived: false },
    { id: 'c-apollo', name: 'project-apollo', type: 'project', topic: 'Real-time dispatch rewrite — target 12 Apr', purpose: 'Apollo is the next-gen dispatch engine.', memberIds: ['p1','p3','p10','p11','p12','p13','p14','p19','p21','p23','p25','p6','p27'], adminIds: ['p1','p10'], createdBy: 'p1', createdAt: '2025-11-04', favorite: true, muted: false, archived: false },
    { id: 'c-phoenix', name: 'project-phoenix', type: 'project', topic: 'Billing platform migration', purpose: 'Migrating billing off the legacy monolith.', memberIds: ['p3','p11','p15','p20','p41','p7','p25','p1'], adminIds: ['p25'], createdBy: 'p25', createdAt: '2025-09-16', favorite: false, muted: true, archived: false },
    { id: 'c-website', name: 'website-redesign', type: 'project', topic: 'northbeam.io refresh — design + web', purpose: '', memberIds: ['p24','p21','p22','p28','p29','p30','p31','p12','p46','p1'], adminIds: ['p24','p28'], createdBy: 'p28', createdAt: '2026-01-08', favorite: false, muted: false, archived: false },
    { id: 'c-launch', name: 'product-launch', type: 'project', topic: 'Apollo GA launch — 12 April', purpose: 'Cross-functional launch war room.', memberIds: ['p1','p6','p28','p29','p30','p31','p5','p32','p33','p36','p21','p24','p27'], adminIds: ['p28','p1'], createdBy: 'p28', createdAt: '2026-02-02', favorite: true, muted: false, archived: false },
    { id: 'c-incidents', name: 'incident-response', type: 'private', topic: 'P1/P2 incidents — page-driven', purpose: 'Restricted to on-call and leadership.', memberIds: ['p3','p10','p13','p14','p11','p19','p43','p1'], adminIds: ['p14'], createdBy: 'p14', createdAt: '2020-02-11', favorite: false, muted: false, archived: false },
    { id: 'c-design-crit', name: 'design-critique', type: 'public', topic: 'Weekly crit — post work in progress', purpose: '', memberIds: desIds.concat(['p1','p21','p22','p25','p6','p46']), adminIds: ['p21'], createdBy: 'p21', createdAt: '2020-01-30', favorite: false, muted: false, archived: false },
    { id: 'c-feedback', name: 'customer-feedback', type: 'public', topic: 'Verbatim customer signal from CS + Sales', purpose: '', memberIds: ['p36','p37','p38','p32','p33','p34','p35','p1','p6','p25','p27','p23'], adminIds: ['p36'], createdBy: 'p36', createdAt: '2021-03-11', favorite: true, muted: false, archived: false },
    { id: 'c-wins', name: 'sales-wins', type: 'public', topic: 'Closed-won celebrations 🎉', purpose: '', memberIds: salIds.concat(['p2','p6','p36','p28','p1','p41']), adminIds: ['p5'], createdBy: 'p5', createdAt: '2019-01-07', favorite: false, muted: false, archived: false },
    { id: 'c-security', name: 'security-alerts', type: 'private', topic: 'Security tooling alerts and reviews', purpose: 'Restricted to IT & Security.', memberIds: ['p43','p14','p3','p42','p1'], adminIds: ['p43'], createdBy: 'p43', createdAt: '2020-08-19', favorite: false, muted: false, archived: false },
    { id: 'c-onsite', name: 'lisbon-onsite-2026', type: 'temporary', topic: 'Company onsite 18–20 May — expires 1 Jun', purpose: 'Temporary channel, auto-archives after the onsite.', memberIds: allIds, adminIds: ['p44','p8'], createdBy: 'p44', createdAt: '2026-02-10', favorite: false, muted: false, archived: false, expiresAt: '2026-06-01' },
    { id: 'c-random', name: 'random', type: 'public', topic: 'Non-work things — memes, pets, coffee', purpose: '', memberIds: allIds, adminIds: ['p44'], createdBy: 'p44', createdAt: '2016-05-02', favorite: false, muted: false, archived: false },
    { id: 'c-legacy', name: 'legacy-dispatch-v1', type: 'public', topic: 'Archived — superseded by #project-apollo', purpose: '', memberIds: ['p3','p10','p11','p1'], adminIds: ['p3'], createdBy: 'p3', createdAt: '2022-05-04', favorite: false, muted: true, archived: true }
  ];

  /* ------------------------------------------------------------------ */
  /* Groups                                                             */
  /* ------------------------------------------------------------------ */
  const GROUPS = [
    { id: 'g-apollo', name: 'Apollo Core Squad', description: 'Daily coordination for the Apollo build team.', memberIds: ['p1','p10','p11','p12','p21','p19','p13'], adminIds: ['p1','p10'], type: 'private', createdAt: '2025-11-06', createdBy: 'p1', emoji: '🚀' },
    { id: 'g-leads', name: 'Product & Design Leads', description: 'Weekly sync between product and design leadership.', memberIds: ['p1','p6','p4','p21','p25','p26','p23'], adminIds: ['p6'], type: 'private', createdAt: '2024-02-19', createdBy: 'p6', emoji: '🧭' },
    { id: 'g-onsite', name: 'Onsite Planning Crew', description: 'Logistics for the May onsite in Lisbon.', memberIds: ['p1','p44','p8','p40','p28','p24'], adminIds: ['p44'], type: 'private', createdAt: '2026-02-11', createdBy: 'p44', emoji: '🎪' },
    { id: 'g-mobile', name: 'Mobile Guild', description: 'Open guild for anyone shipping mobile.', memberIds: ['p16','p17','p18','p12','p22','p1','p19'], adminIds: ['p16'], type: 'public', createdAt: '2023-08-01', createdBy: 'p16', emoji: '📱' },
    { id: 'g-launch-war', name: 'Launch War Room', description: 'Go/no-go decisions for 12 April.', memberIds: ['p1','p28','p6','p5','p36','p3','p21'], adminIds: ['p28'], type: 'private', createdAt: '2026-03-02', createdBy: 'p28', emoji: '🛎️' }
  ];

  /* ------------------------------------------------------------------ */
  /* Direct message conversations                                       */
  /* ------------------------------------------------------------------ */
  const DMS = [
    { id: 'd-p10', peerId: 'p10', pinned: true },
    { id: 'd-p21', peerId: 'p21', pinned: true },
    { id: 'd-p3',  peerId: 'p3',  pinned: false },
    { id: 'd-p25', peerId: 'p25', pinned: false },
    { id: 'd-p8',  peerId: 'p8',  pinned: false },
    { id: 'd-p32', peerId: 'p32', pinned: false },
    { id: 'd-p13', peerId: 'p13', pinned: false },
    { id: 'd-p2',  peerId: 'p2',  pinned: false },
    { id: 'd-p27', peerId: 'p27', pinned: false },
    { id: 'd-p46', peerId: 'p46', pinned: false },
    { id: 'd-p19', peerId: 'p19', pinned: false },
    { id: 'd-p28', peerId: 'p28', pinned: false }
  ];

  /* ------------------------------------------------------------------ */
  /* Message scripts                                                    */
  /* [authorId, minutesAgo, text, extra]                                */
  /* ------------------------------------------------------------------ */
  const SCRIPTS = {
    'd-p10': [
      ['p10', 3 * D + 200, 'Morning! Did you get a chance to look at the routing RFC? I left the trade-off table at the bottom.'],
      ['p1', 3 * D + 180, 'Reading it now. The hybrid approach looks right — my only worry is the cold-start latency on the first dispatch of the day.'],
      ['p10', 3 * D + 170, 'Fair. We can pre-warm the graph at 04:00 local per region. Adds ~$120/mo in compute, saves ~800ms p95.'],
      ['p1', 3 * D + 160, 'That trade is easy. Ship it.'],
      ['p10', 2 * D + 60, 'Routing RFC v3 is up — I incorporated the pre-warm plan and Amara\'s notes on the failover path.', { files: ['f-rfc'] }],
      ['p1', 2 * D + 40, 'Beautiful. I\'ll get Rachel to sign off today so we can start Monday.'],
      ['p10', 300, 'Quick heads-up: the load test finished. p95 is 412ms at 3x peak traffic — comfortably inside the 600ms budget.', { reactions: { '🎉': ['p1', 'p13'], '🚀': ['p11'] } }],
      ['p1', 290, 'That is a fantastic number. Can you drop the chart in #project-apollo so the whole team sees it?'],
      ['p10', 285, 'Already done. Also attached the raw results here in case you want them for the launch deck.', { files: ['f-loadtest'] }],
      ['p10', 22, 'One more thing — do we want to include the failover demo in the GA launch video? It is genuinely impressive.'],
      ['p1', 18, 'Yes. Let me check with Camille on the runtime, but I think we can spare 30 seconds for it.'],
      ['p10', 6, 'Perfect. I can record a clean take tomorrow morning your time.']
    ],
    'd-p21': [
      ['p21', 2 * D + 400, 'Dispatch board v4 is ready for you. I reworked the density toggle after Ines\' research — three densities felt like one too many.'],
      ['p21', 2 * D + 398, '', { files: ['f-dispatch-board'] }],
      ['p1', 2 * D + 380, 'The two-density version is much cleaner. What happens to the row actions at compact density?'],
      ['p21', 2 * D + 372, 'They collapse into the overflow menu, and we keep Assign inline because it is 80% of the usage.'],
      ['p1', 2 * D + 360, 'Agreed. That matches what Grace saw in the telemetry.'],
      ['p21', 640, 'Small thing — can we get a decision on the empty state copy today? Kofi needs it for the illustration set.'],
      ['p1', 620, 'Yes. Let\'s go with "No active routes yet — assign a driver to get moving." Short, tells them the next action.'],
      ['p21', 615, 'Love it. Sending to Kofi.', { reactions: { '👍': ['p1'] } }],
      ['p21', 45, 'Prototype link for tomorrow\'s crit is in the channel. Would love your take on the assignment drawer before then.'],
      ['p1', 40, 'Will do — I have 20 minutes after the standup.']
    ],
    'd-p3': [
      ['p3', 5 * D, 'Aarav, headcount plan for Q3: I want two more platform engineers. Can Apollo absorb one of them in the first month?'],
      ['p1', 5 * D - 30, 'Yes, if they land before June. After GA we move into the reliability phase and there is plenty of scoped work.'],
      ['p3', 5 * D - 20, 'Good. I\'ll put it in the plan for Thomas.'],
      ['p3', 180, 'Are we still green for the 12 April GA date?'],
      ['p1', 170, 'Green with one watch item: the billing migration dependency in #project-phoenix. Julia is tracking it and we have a fallback that ships GA without usage-based billing.'],
      ['p3', 165, 'That fallback is acceptable. Please put it in writing in the launch doc so nobody is surprised.'],
      ['p1', 160, 'Adding it now.']
    ],
    'd-p25': [
      ['p25', 1 * D + 120, 'Phoenix update: the ledger reconciliation job is passing on staging for the fifth consecutive night.'],
      ['p1', 1 * D + 110, 'That is the streak we needed. When do you want to make the cutover call?'],
      ['p25', 1 * D + 105, 'Proposing Thursday, with Victor and Thomas on the call. Anna signed off on the customer notice already.'],
      ['p1', 1 * D + 100, 'Works. I\'ll join for the first 30 minutes.'],
      ['p25', 95, 'Cutover invite is out. Also — do you want usage-based billing in the GA scope or as a fast-follow?'],
      ['p1', 88, 'Fast-follow. Two weeks after GA, so we can watch the dispatch metrics without a second variable.'],
      ['p25', 84, 'Sensible. I\'ll update the spec.', { reactions: { '✅': ['p1'] } }]
    ],
    'd-p8': [
      ['p8', 6 * D, 'Reminder that your team\'s growth conversations are due by the end of next week. Templates are in the People hub.'],
      ['p1', 6 * D - 40, 'Thanks Nadia — three of four are booked. I\'ll get the last one scheduled today.'],
      ['p8', 260, 'Also, benefits enrolment closes Friday. You have not confirmed your selections yet.'],
      ['p1', 250, 'Doing it right after standup. Thanks for the nudge.'],
      ['p8', 20, 'Great — and congratulations on the Apollo load test numbers. Marcus mentioned them in the leadership sync.', { reactions: { '🙏': ['p1'] } }]
    ],
    'd-p32': [
      ['p32', 2 * D + 30, 'Vantage Freight asked whether Apollo supports multi-depot routing at GA. Can you confirm?'],
      ['p1', 2 * D + 20, 'Yes — multi-depot is in GA. What is not in GA is cross-border customs handling; that is on the H2 roadmap.'],
      ['p32', 2 * D + 15, 'Perfect, that is enough for the security review. Sending them the one-pager.'],
      ['p32', 130, 'They signed. €480k ACV, three-year term. 🎉', { reactions: { '🎉': ['p1','p5','p2'], '🔥': ['p6'] } }],
      ['p1', 125, 'Outstanding. That is the largest logistics deal we have closed. Congratulations Sarah!'],
      ['p32', 120, 'Team effort — Michael\'s security answers did a lot of the work. Can we get them onto the Apollo beta?'],
      ['p1', 110, 'Absolutely. I\'ll add them to the design partner list this afternoon.']
    ],
    'd-p13': [
      ['p13', 1 * D + 400, 'The platform team can take the rate limiting work for Apollo, but it would push the audit-log refactor to May.'],
      ['p1', 1 * D + 380, 'Rate limiting matters more for GA. Let\'s take the trade.'],
      ['p13', 1 * D + 370, 'Agreed. I\'ll re-plan the sprint and let Marcus know.'],
      ['p13', 340, 'Sprint re-planned. Jonas has the rate limiting spike, Meera takes the config service.'],
      ['p1', 330, 'Thanks Amara. Anything you need from me?'],
      ['p13', 320, 'Just the decision in writing for the audit-log delay — the compliance folks will ask.'],
      ['p1', 315, 'Posting it in #project-apollo now so it is searchable.']
    ],
    'd-p2': [
      ['p2', 4 * D, 'Aarav — can you prepare a five-slide Apollo summary for the board on the 30th? Outcomes, not features.'],
      ['p1', 4 * D - 60, 'Yes. I\'ll frame it around dispatch time saved per depot and the retention signal from the beta cohort.'],
      ['p2', 4 * D - 55, 'Exactly right. Send me a draft by the 26th.'],
      ['p1', 200, 'Draft is ready for your review — five slides, plus an appendix with the load test data.', { files: ['f-board-deck'] }],
      ['p2', 60, 'Read it on the plane. Slide 3 is the strongest thing we will show. Tighten slide 4 and it is ready.', { reactions: { '👏': ['p1'] } }]
    ],
    'd-p27': [
      ['p27', 900, 'Beta cohort numbers for week 6: 71% weekly active, median dispatch time down 34% versus control.'],
      ['p1', 890, 'Both of those are above target. Can you cut it by depot size?'],
      ['p27', 880, 'Yes — small depots see 41% improvement, large depots 22%. The large-depot gap is mostly manual overrides.'],
      ['p1', 870, 'That is a great insight for the roadmap. Can you write it up for the launch doc?'],
      ['p27', 300, 'Written up and linked in #project-apollo. I also built a dashboard so you can watch it live.', { files: ['f-beta-metrics'] }]
    ],
    'd-p46': [
      ['p46', 3 * D, 'Hi Aarav — Helio here. The illustration set for the empty states is 80% done. Sharing three directions tomorrow.'],
      ['p1', 3 * D - 90, 'Thanks Claire. Please make sure they work on both light and dark surfaces.'],
      ['p46', 3 * D - 80, 'Already testing both. I\'ll include the dark variants in the review file.'],
      ['p46', 720, 'Three directions attached. My recommendation is direction B — it scales down to 64px without losing legibility.', { files: ['f-illustrations'] }],
      ['p1', 700, 'B is my favourite too. Let me get Sofia and Kofi to confirm and then we can commission the full set.']
    ],
    'd-p19': [
      ['p19', 400, 'Regression suite for Apollo RC2: 1,284 passing, 3 failing. All three are the flaky map-tile test.'],
      ['p1', 390, 'Can we quarantine the flaky test and file a ticket, or does it hide a real bug?'],
      ['p19', 385, 'It is genuinely flaky — a tile CDN timeout. Quarantining and filing QA-812 to stub the CDN.'],
      ['p1', 380, 'Perfect. Thanks for being precise about it.'],
      ['p19', 30, 'RC3 build is green across all three environments. I think we are in good shape for the go/no-go.', { reactions: { '✅': ['p1','p3'] } }]
    ],
    'd-p28': [
      ['p28', 260, 'Launch runtime is 4 minutes 30. If we add the failover demo we have to cut the customer quote section.'],
      ['p1', 250, 'Keep the customer quote. It converts better than a technical demo.'],
      ['p28', 245, 'Agreed — I\'ll put the failover demo in the technical deep-dive video instead.'],
      ['p1', 240, 'Great compromise. Priya can record it tomorrow.'],
      ['p28', 15, 'Press embargo lifts 12 April 09:00 CET. Three outlets confirmed, two more pending.']
    ],

    'g-apollo': [
      ['p10', 1 * D + 60, 'Standup thread for today — drop your update here if you cannot make the call.'],
      ['p11', 1 * D + 40, 'Yesterday: finished the dispatch event schema. Today: wiring the replay consumer. No blockers.'],
      ['p12', 1 * D + 35, 'Yesterday: virtualised the route list, 4k rows now scroll at 60fps. Today: the assignment drawer. Blocked on final copy — thanks Zara.'],
      ['p21', 1 * D + 30, 'Copy is decided as of last night, Chen. Sending you the strings file.', { files: ['f-copy-strings'] }],
      ['p19', 1 * D + 20, 'Regression pass overnight was green apart from the known flaky tile test.'],
      ['p13', 1 * D + 10, 'Platform: rate limiting spike is done, design doc is out for review.'],
      ['p1', 400, 'Decision recorded: usage-based billing moves to a fast-follow two weeks after GA. Rationale is in the launch doc.', { pinned: true, reactions: { '👍': ['p10','p11','p25','p13'] } }],
      ['p10', 300, 'Load test complete: p95 412ms at 3x peak. Attaching the report.', { files: ['f-loadtest'], reactions: { '🚀': ['p1','p12','p13','p19'], '🎉': ['p11'] } }],
      ['p12', 120, 'Assignment drawer is on staging. @Zara.Ahmed would you take a look before the crit?'],
      ['p21', 110, 'Looking now.'],
      ['p21', 95, 'Two notes: the drawer needs a 240ms ease-out rather than linear, and the driver avatar should be 32px not 28px. Otherwise it is excellent.'],
      ['p12', 90, 'Both fixed and deployed.', { reactions: { '⚡': ['p21','p1'] } }],
      ['p19', 25, 'RC3 is green. Go/no-go is booked for tomorrow 15:00 CET.']
    ],
    'g-leads': [
      ['p6', 2 * D, 'Agenda for Thursday: Apollo GA readiness, H2 discovery themes, and the design systems investment case.'],
      ['p4', 2 * D - 40, 'I\'ll bring the systems case. Short version: two engineers for one quarter buys us roughly 30% faster feature delivery in the front end.'],
      ['p1', 2 * D - 30, 'If you have the data behind that 30%, it will land very well with Marcus.'],
      ['p4', 2 * D - 25, 'Zara has been measuring it per component. I\'ll bring the numbers.'],
      ['p23', 500, 'Research readout for H2 themes is ready — three themes, one of which surprised me.'],
      ['p6', 480, 'Do not spoil it, save it for Thursday. 🙂', { reactions: { '😄': ['p1','p23','p21'] } }],
      ['p21', 90, 'Adding one item: we need a decision on whether the mobile app adopts the new density tokens this quarter or next.']
    ],
    'g-onsite': [
      ['p44', 3 * D, 'Venue confirmed: Cais do Sodré, 18–20 May. Capacity 220 with the terrace.'],
      ['p8', 3 * D - 50, 'Perfect. Travel budget approved by Thomas this morning.'],
      ['p40', 3 * D - 30, 'I\'ll open the registration form on Monday and set a two-week deadline.'],
      ['p24', 2 * D, 'Brand kit for the onsite is done — signage, badges, deck template.', { files: ['f-onsite-brand'] }],
      ['p1', 700, 'Can we reserve a 90-minute product slot on day two? I want to demo Apollo GA to the whole company.'],
      ['p44', 690, 'Booked — day two, 14:00, main stage.', { reactions: { '🙌': ['p1'] } }],
      ['p28', 60, 'Dietary requirements form goes out with registration. Please fill it in even if you have none — it helps the count.']
    ],
    'g-mobile': [
      ['p16', 2 * D + 200, 'Compose 1.7 upgrade is merged. Build times down 18%.'],
      ['p18', 2 * D + 180, 'Confirmed on my machine — clean build went from 4:10 to 3:24.'],
      ['p17', 2 * D + 100, 'iOS side: offline dispatch sync is working end to end. Conflict resolution still needs a design decision.'],
      ['p22', 800, 'I sketched three conflict resolution patterns. My preference is the "keep both, flag for review" one.', { files: ['f-conflict-patterns'] }],
      ['p17', 780, 'That is the safest for dispatchers. Losing an assignment silently would be terrible.'],
      ['p16', 200, 'Agreed, let\'s go with keep-both. @Yuki.Tanaka can you spec it?'],
      ['p17', 40, 'On it tomorrow morning.']
    ],
    'g-launch-war': [
      ['p28', 1 * D, 'Launch checklist is live. 42 items, 31 done, 4 at risk.', { files: ['f-launch-checklist'] }],
      ['p1', 1 * D - 20, 'Which four are at risk?'],
      ['p28', 1 * D - 15, 'Pricing page copy, the German translation, the partner email, and the in-app tour.'],
      ['p6', 1 * D - 10, 'Pricing page copy — I can own that and have it done by Wednesday.'],
      ['p36', 500, 'In-app tour: CS can write the script if design can build it. Zara?'],
      ['p21', 480, 'We can build it. Send the script by Friday and it ships Monday.'],
      ['p5', 200, 'Sales enablement is done — battlecards, demo script, objection handling. All in the Files hub.'],
      ['p28', 45, 'Go/no-go tomorrow at 15:00 CET. Everyone on this list should attend.', { pinned: true }]
    ],

    'c-general': [
      ['p8', 2 * D + 300, 'Welcome to the three people joining Northbeam this week: Tobias in Finance, Emily in People Ops, and Ryan joining as an external collaborator on the migration project. Please say hello. 👋', { reactions: { '👋': ['p1','p10','p21','p13','p28','p44'], '🎉': ['p40','p45'] } }],
      ['p45', 2 * D + 280, 'Thank you! Delighted to be here. I\'ll be working with Victor on revenue forecasting.'],
      ['p44', 1 * D + 200, 'The Lisbon office will have limited desk space on Thursday — the electrical works finally start. Remote is encouraged.'],
      ['p29', 1 * D + 100, 'New case study is live: how Vantage Freight cut dispatch time by a third with Northbeam. Great quotes in this one.'],
      ['p2', 600, 'Q1 wrapped ahead of plan on revenue and slightly behind on hiring. Full detail in the all-hands recording — link in #announcements. Thank you all, genuinely.', { reactions: { '🎉': ['p1','p3','p5','p8','p28','p36','p32'], '👏': ['p6','p21','p13'] } }],
      ['p44', 240, 'Reminder: the coffee machine on level 3 is fixed. It was, as suspected, a spoon.', { reactions: { '😂': ['p1','p21','p29','p40','p24','p12'], '☕': ['p8'] } }],
      ['p40', 90, 'Benefits enrolment closes Friday at 18:00 WET. If you do nothing, you keep last year\'s selections.'],
      ['p24', 35, 'The onsite brand kit is done and it looks fantastic if I say so myself. Preview in #lisbon-onsite-2026.']
    ],
    'c-announcements': [
      ['p2', 15 * D, 'Northbeam has closed a $42M Series C led by Arbor Capital. This gives us four years of runway and lets us accelerate the platform roadmap. Full details and an FAQ are attached.', { files: ['f-series-c'], pinned: true, reactions: { '🎉': ['p1','p3','p4','p5','p6','p8','p10','p21','p28','p32','p36'], '🚀': ['p13','p11','p12'] } }],
      ['p8', 8 * D, 'Updated remote working policy is now in effect. The headline change: core collaboration hours are 14:00–17:00 CET, and everything outside that is genuinely async. Please read the full policy.', { files: ['f-remote-policy'], pinned: true }],
      ['p43', 4 * D, 'Mandatory security training must be completed by 15 April. It takes 25 minutes. Non-completion will restrict access to production systems.', { reactions: { '👍': ['p1','p13','p3'] } }],
      ['p2', 600, 'Q1 all-hands recording and slides are available. We beat the revenue plan by 8% and closed the largest deal in company history.', { files: ['f-allhands'] }],
      ['p28', 120, 'Apollo GA launches 12 April at 09:00 CET. Press embargo lifts at the same time — please do not post publicly before then.', { pinned: true }]
    ],
    'c-engineering': [
      ['p3', 2 * D + 500, 'Reminder that the architecture review board meets Wednesday. Two RFCs on the agenda: routing (Priya) and rate limiting (Amara).'],
      ['p14', 2 * D + 90, 'Postmortem for the 03:41 UTC alert is written. Root cause was a stale DNS entry after the region failover test. No customer impact.', { files: ['f-postmortem'], reactions: { '🙏': ['p3','p13','p10'] } }],
      ['p20', 1 * D + 300, 'The dbt migration to the new warehouse is complete. All 214 models are running on the new cluster and costs are down 31%.', { reactions: { '🔥': ['p3','p13','p45','p27'] } }],
      ['p10', 1 * D + 100, 'Routing RFC v3 is up for review. Please leave comments by Wednesday morning.', { files: ['f-rfc'] }],
      ['p11', 800, 'PSA: we are dropping Node 18 support in the internal tooling next sprint. If you have a script pinned to it, now is the time.'],
      ['p15', 400, 'Config service is deployed to staging. It reads from the new schema and falls back to the old one for a week.'],
      ['p14', 200, 'On call this week. Pager is quiet so far. The rate limiting spike is done — writeup incoming.'],
      ['p12', 60, 'Virtualised list is merged. 4,000-row route tables now scroll at 60fps on a 2019 MacBook.', { reactions: { '⚡': ['p3','p10','p21','p1'] } }],
      ['p19', 12, 'RC3 is green on all environments. Test report attached.', { files: ['f-testreport'] }]
    ],
    'c-design': [
      ['p4', 3 * D, 'Design team: our systems investment case goes to leadership Thursday. Zara has the component-level velocity data — it is a strong story.'],
      ['p21', 2 * D + 100, 'Dispatch board v4 posted for crit. Main change is two densities instead of three, based on Ines\' interviews.', { files: ['f-dispatch-board'], reactions: { '👀': ['p22','p4','p1'], '❤️': ['p24'] } }],
      ['p23', 1 * D + 400, 'Research readout: five dispatcher interviews. The recurring theme is that they do not trust automatic assignment until they can see why it chose that driver.', { files: ['f-research'], reactions: { '💡': ['p21','p1','p6','p22'] } }],
      ['p1', 1 * D + 380, 'That is the single most useful finding we have had this quarter. Explainability needs to be in GA, even if it is a simple reason string.'],
      ['p21', 1 * D + 370, 'Agreed. I can design a compact "why this driver" popover in a day.'],
      ['p24', 700, 'Onsite brand kit is done. Signage, badges, deck template, and a small illustration set.', { files: ['f-onsite-brand'] }],
      ['p22', 300, 'Motion spec for the assignment drawer: 240ms, ease-out, 8px translate. Consistent with the rest of the system.'],
      ['p46', 80, 'Empty state illustrations, three directions. Dark variants included.', { files: ['f-illustrations'], reactions: { '🎨': ['p21','p24','p4'] } }]
    ],
    'c-product': [
      ['p6', 2 * D + 200, 'H2 planning starts in three weeks. Please bring evidence, not opinions — usage data, interviews, or revenue impact.'],
      ['p27', 1 * D + 200, 'Beta cohort week 6: 71% weekly active, dispatch time down 34% median. Small depots benefit most.', { files: ['f-beta-metrics'], reactions: { '📈': ['p1','p6','p25'] } }],
      ['p25', 600, 'Phoenix cutover is proposed for Thursday. Finance and Legal have signed off.'],
      ['p26', 400, 'Integrations spec v2 is out. Covers Google Drive, OneDrive, and the two calendar providers. Feedback by Friday please.', { files: ['f-integrations-spec'] }],
      ['p1', 100, 'Recording the decision here too: usage-based billing is a fast-follow, two weeks after GA. Reason is measurement cleanliness, not engineering capacity.', { pinned: true }]
    ],
    'c-marketing': [
      ['p28', 2 * D, 'Launch week plan is final. Blog, press, customer webinar, and a technical deep-dive video.'],
      ['p29', 1 * D + 200, 'Blog draft is ready for review. 1,100 words, leads with the Vantage Freight number.', { files: ['f-blog-draft'] }],
      ['p30', 800, 'Paid campaign is built. Three audiences, two creatives each. We start at 30% budget and scale what works.'],
      ['p31', 500, 'Attribution is fixed — the form fill was not passing UTM parameters through the redirect. Two weeks of data is now recoverable.', { reactions: { '🙏': ['p28','p30'] } }],
      ['p24', 200, 'Launch creative set is delivered: social, email header, in-app banner, and the deck template.', { files: ['f-launch-creative'] }],
      ['p28', 40, 'Press embargo lifts 12 April 09:00 CET. Three outlets confirmed.']
    ],
    'c-sales': [
      ['p5', 2 * D + 300, 'Q1 closed at 112% of plan. Excellent quarter. Q2 targets are in the forecast sheet.'],
      ['p33', 1 * D + 100, 'New security questionnaire responses are in the enablement folder. SOC 2 Type II report is current.', { files: ['f-soc2'] }],
      ['p34', 700, 'Outbound experiment results: the depot-size-specific sequence outperforms the generic one by 2.4x on reply rate.', { reactions: { '📈': ['p5','p32','p35'] } }],
      ['p32', 130, 'Vantage Freight signed. €480k ACV, three-year term.', { reactions: { '🎉': ['p5','p1','p2','p6','p36','p33','p35','p34'], '🔥': ['p28'] } }],
      ['p35', 60, 'Two mid-market deals moved to verbal this week. Both cite the new dispatch board in the demo as the turning point.']
    ],
    'c-people-ops': [
      ['p8', 5 * D, 'Growth conversations open this cycle. Managers, your templates are in the People hub. Deadline is the end of next week.'],
      ['p40', 2 * D, 'Benefits enrolment is open until Friday. New this year: expanded mental health cover and a home office stipend.', { files: ['f-benefits'], reactions: { '🙌': ['p1','p12','p21','p45','p18'] } }],
      ['p39', 1 * D, 'We are hiring for six roles this quarter. Referrals get a €2,000 bonus on a successful hire.'],
      ['p8', 300, 'A gentle reminder that core collaboration hours are 14:00–17:00 CET. Outside those hours, please do not expect a reply.', { reactions: { '👏': ['p10','p17','p18','p22','p12'] } }],
      ['p40', 25, 'The onsite registration form opens Monday. Please complete it even if you cannot attend.']
    ],
    'c-apollo': [
      ['p1', 5 * D, 'Welcome to the Apollo channel. Target GA is 12 April. Scope, decisions and risks all live here so they are searchable later.', { pinned: true }],
      ['p10', 4 * D, 'Architecture overview is pinned. The short version: event-sourced dispatch core, a routing service behind gRPC, and a read model optimised for the board.', { files: ['f-architecture'], pinned: true }],
      ['p21', 3 * D + 200, 'Dispatch board v4 with two densities. Crit is Thursday.', { files: ['f-dispatch-board'] }],
      ['p23', 3 * D, 'Interview finding worth repeating here: dispatchers will not trust automated assignment without a reason. Explainability needs to be in GA.', { reactions: { '💡': ['p1','p10','p21','p25','p6'] } }],
      ['p1', 2 * D + 400, 'Scope decision: adding a compact "why this driver" reason string to GA. Zara is designing it, Chen is building it. This is the last scope addition before GA.', { pinned: true, reactions: { '👍': ['p10','p12','p21','p19','p13'] } }],
      ['p13', 2 * D, 'Decision recorded: rate limiting takes priority over the audit-log refactor, which moves to May. Compliance is aware.'],
      ['p11', 1 * D + 300, 'Replay consumer is live on staging. We can now rebuild the entire read model in 90 seconds.', { reactions: { '🚀': ['p10','p13','p1'] } }],
      ['p12', 1 * D + 100, 'Assignment drawer is on staging with the motion spec applied.'],
      ['p19', 800, 'RC2 regression: 1,284 pass, 3 fail. All three are the known flaky map-tile test. Quarantined as QA-812.'],
      ['p1', 400, 'Decision recorded: usage-based billing moves to a fast-follow two weeks after GA. Rationale is measurement cleanliness.', { pinned: true }],
      ['p10', 300, 'Load test results: p95 412ms at 3x peak traffic, error rate 0.02%. Well inside budget.', { files: ['f-loadtest'], reactions: { '🎉': ['p1','p13','p19','p25','p6','p3'], '🚀': ['p11','p12'] } }],
      ['p27', 200, 'Beta metrics dashboard is live and updating hourly.', { files: ['f-beta-metrics'] }],
      ['p19', 20, 'RC3 is green across all environments. Go/no-go tomorrow 15:00 CET.', { reactions: { '✅': ['p1','p10','p3'] } }],
      ['p14', 8, 'Runbook for GA day is written: rollout stages, rollback triggers, and who to page.', { files: ['f-runbook'] }]
    ],
    'c-phoenix': [
      ['p25', 4 * D, 'Phoenix status: ledger reconciliation passing on staging, five nights running.'],
      ['p41', 3 * D, 'Finance validated the March numbers against the new ledger. Variance is €0.00 across 1.2M line items.', { reactions: { '🎯': ['p25','p7','p20','p1'] } }],
      ['p20', 2 * D, 'Data pipeline for the new ledger is backfilled to 2023.'],
      ['p15', 1 * D, 'Legacy write path is now behind a feature flag. We can cut over and roll back in under a minute.'],
      ['p25', 300, 'Cutover proposed for Thursday 10:00 CET. Victor and Thomas confirmed.'],
      ['p7', 120, 'Approved. Please send the customer notice 48 hours before.']
    ],
    'c-website': [
      ['p28', 3 * D, 'Website refresh kicks off. Goal is a 20% lift in demo requests, mostly by fixing the pricing page.'],
      ['p24', 2 * D + 100, 'Visual direction is approved. Warmer photography, more product, far fewer gradients.', { files: ['f-web-direction'] }],
      ['p22', 1 * D + 200, 'Component library for the marketing site is 60% built.'],
      ['p12', 700, 'The new site is on the same design tokens as the product, so brand changes propagate automatically.', { reactions: { '👌': ['p24','p21','p28'] } }],
      ['p46', 200, 'Hero illustration is in review — three variants.', { files: ['f-illustrations'] }],
      ['p30', 40, 'Pricing page copy is the last blocker. Rachel is writing it by Wednesday.']
    ],
    'c-launch': [
      ['p28', 2 * D, 'Launch war room is open. Checklist has 42 items — I will post the burn-down daily.', { files: ['f-launch-checklist'], pinned: true }],
      ['p29', 1 * D + 300, 'Blog draft is ready. Leads with the 34% dispatch time reduction.'],
      ['p5', 1 * D, 'Sales enablement is complete: battlecards, demo script, objection handling, pricing FAQ.', { files: ['f-battlecards'] }],
      ['p36', 700, 'CS readiness: support macros written, escalation path agreed, and the beta customers have been briefed.'],
      ['p27', 400, 'Launch dashboard is built — signups, activation, dispatch volume, and error rate, all in one view.'],
      ['p21', 200, 'In-app tour is designed. Five steps, skippable, and it remembers where you stopped.'],
      ['p28', 30, 'Go/no-go tomorrow 15:00 CET. Attendance is required for anyone with an at-risk item.', { pinned: true }]
    ],
    'c-incidents': [
      ['p14', 2 * D + 120, 'ALERT — elevated 5xx on the dispatch API, EU-West. Investigating.', { reactions: { '👀': ['p3','p13','p10'] } }],
      ['p14', 2 * D + 110, 'Cause identified: stale DNS entry after the region failover test. Rolling back the test config.'],
      ['p14', 2 * D + 100, 'Resolved. Total duration 11 minutes, no customer-visible impact — the retry logic absorbed it.'],
      ['p3', 2 * D + 95, 'Good, fast work. Please write the postmortem while it is fresh.'],
      ['p14', 2 * D + 60, 'Postmortem is written and linked. Two action items, both assigned.', { files: ['f-postmortem'] }],
      ['p43', 1 * D, 'Related: I have added a check to catch stale DNS entries after failover tests. It runs in CI.']
    ],
    'c-design-crit': [
      ['p21', 2 * D + 60, 'Crit Thursday 16:00 CET. On the agenda: dispatch board v4, the reason popover, and the empty state illustrations.'],
      ['p22', 1 * D, 'Posting motion explorations for the drawer. Three timings — I prefer the middle one.'],
      ['p24', 600, 'Illustration direction B for review. It holds up at 64px which is the real test.', { files: ['f-illustrations'] }],
      ['p23', 300, 'Reminder that we can test any of this with dispatchers on Friday. I have four sessions booked.'],
      ['p4', 50, 'Please keep crits to work in progress. Finished work belongs in a review, not a crit.', { reactions: { '👍': ['p21','p22','p24'] } }]
    ],
    'c-feedback': [
      ['p37', 2 * D + 200, 'Vantage Freight: "The new dispatch board is the first tool my team has not complained about." Direct quote from their operations director.', { reactions: { '❤️': ['p1','p21','p6','p23'], '🎉': ['p32'] } }],
      ['p38', 1 * D + 300, 'Recurring support theme this month: customers want to export the dispatch history as CSV. Eleven requests in three weeks.'],
      ['p1', 1 * D + 290, 'Eleven is a signal. Adding it to the H2 candidate list with the ticket numbers attached.'],
      ['p33', 800, 'Security reviews are getting easier now that the SOC 2 Type II report is current. Two prospects cleared us in under a week.'],
      ['p37', 300, 'Churn risk flagged: Baltic Haulage. Usage is down 40% since their operations lead left. I have a call booked Thursday.', { reactions: { '👀': ['p36','p5','p1'] } }],
      ['p23', 60, 'The explainability finding matches what CS hears. Two independent sources pointing at the same thing.']
    ],
    'c-wins': [
      ['p32', 130, 'CLOSED WON — Vantage Freight. €480k ACV, three-year term. Largest logistics deal to date. 🎉', { reactions: { '🎉': ['p5','p1','p2','p6','p36','p33','p35','p34','p28','p41'], '🔥': ['p30','p29'], '👏': ['p8','p44'] } }],
      ['p35', 1 * D, 'CLOSED WON — Nordkraft Logistik. €96k ACV. They cited the demo of the new board specifically.', { reactions: { '🎉': ['p5','p32','p33'] } }],
      ['p34', 2 * D, 'The outbound team booked 34 qualified meetings this month, a record.', { reactions: { '🚀': ['p5','p35'] } }]
    ],
    'c-security': [
      ['p43', 2 * D, 'Quarterly access review starts today. Managers will get a list of their reports\' access to review.'],
      ['p43', 1 * D, 'Two dormant service accounts have been disabled. Neither had been used in 90 days.'],
      ['p14', 600, 'Added the stale-DNS check to CI following the failover incident.'],
      ['p42', 200, 'The updated DPA template is approved and in the Legal folder. Please use it for all new enterprise contracts.'],
      ['p43', 30, 'Reminder: mandatory security training is due 15 April. Currently at 71% completion.']
    ],
    'c-onsite': [
      ['p44', 3 * D, 'Onsite is confirmed: Lisbon, 18–20 May, at Cais do Sodré.', { pinned: true, reactions: { '🎉': ['p1','p8','p21','p24','p40','p28','p12','p13'] } }],
      ['p8', 2 * D, 'Travel budget is approved. Book through the usual portal and keep it reasonable.'],
      ['p24', 1 * D, 'Brand kit for the onsite — signage, badges, and a deck template.', { files: ['f-onsite-brand'], reactions: { '🎨': ['p44','p8','p21','p1'] } }],
      ['p40', 400, 'Registration opens Monday. There will be a dietary requirements section.'],
      ['p1', 60, 'We have a 90-minute product slot on day two. I will demo Apollo GA.', { reactions: { '🙌': ['p44','p21','p10','p28'] } }]
    ],
    'c-random': [
      ['p44', 1 * D + 400, 'The level 3 coffee machine is fixed. The cause was, as everyone suspected, a spoon.', { reactions: { '😂': ['p1','p21','p29','p40','p24','p12','p13','p45'] } }],
      ['p12', 1 * D, 'My cat has discovered the standing desk motor. Standup may be chaotic.', { reactions: { '😹': ['p21','p18','p22','p40'] } }],
      ['p29', 700, 'Someone has left an excellent sourdough starter in the Lisbon kitchen. Claim it or I am adopting it.'],
      ['p18', 300, 'Mexico City office is doing tacos on Friday. Remote colleagues, we will think of you.', { reactions: { '🌮': ['p1','p12','p21','p35','p44'] } }],
      ['p45', 45, 'Unrelated to work: the Berlin office plant has survived a full year. I am the plant.', { reactions: { '🌱': ['p44','p40','p21'] } }]
    ],
    'c-legacy': [
      ['p3', 40 * D, 'This channel is archived. Everything moved to #project-apollo. History is preserved for reference.']
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Thread replies:  parent message key -> replies                     */
  /* ------------------------------------------------------------------ */
  const THREAD_SCRIPTS = {
    'c-apollo:2': [ /* index of message inside channel */
      ['p1', 3 * D - 30, 'This is the clearest architecture doc we have written. Two questions: how does the read model handle a partial replay, and what is the recovery time objective?'],
      ['p10', 3 * D - 45, 'Partial replay is idempotent — we key on the event id, so replaying a subset is safe. RTO is 90 seconds for a full rebuild.'],
      ['p13', 3 * D - 60, 'Worth adding the RTO explicitly to the doc. Compliance will ask.'],
      ['p10', 3 * D - 70, 'Added.'],
      ['p3', 3 * D - 90, 'Approved from the architecture review board.']
    ],
    'c-design:2': [
      ['p1', 1 * D + 360, 'Can you share the interview clips? I want to use one in the board deck.'],
      ['p23', 1 * D + 350, 'Yes — three clips, all with consent for internal use. Uploading now.'],
      ['p21', 1 * D + 340, 'The clip where he says "I just want to know why" is the one.'],
      ['p6', 1 * D + 300, 'Agreed. That single sentence should shape the H2 roadmap.'],
      ['p23', 1 * D + 280, 'I will pull it as a 20-second cut.']
    ],
    'c-engineering:3': [
      ['p11', 1 * D + 80, 'Left comments. The failover path is right, but I would make the circuit breaker thresholds configurable per region.'],
      ['p10', 1 * D + 70, 'Good call — different regions have genuinely different tail latency.'],
      ['p13', 1 * D + 40, 'Also worth documenting what happens if the routing service is down entirely. Do we fall back to the last known good plan?'],
      ['p10', 1 * D + 30, 'Yes, and we surface a banner in the board so dispatchers know they are on a stale plan. Adding it to v3.'],
      ['p3', 1 * D + 10, 'That banner is important. Please make sure design sees it.']
    ],
    'c-launch:0': [
      ['p1', 1 * D + 500, 'Which items are at risk and who owns them?'],
      ['p28', 1 * D + 480, 'Pricing copy (Rachel), German translation (vendor), partner email (me), in-app tour (Zara).'],
      ['p6', 1 * D + 460, 'Pricing copy will be done Wednesday.'],
      ['p21', 1 * D + 400, 'In-app tour is designed. It needs the CS script to build.'],
      ['p36', 1 * D + 380, 'Script by Friday.']
    ],
    'g-apollo:6': [
      ['p11', 380, 'Makes sense. It also means we do not have to freeze the billing schema before GA.'],
      ['p25', 370, 'Correct, and it gives Finance an extra two weeks to validate.'],
      ['p13', 360, 'No objections from platform.']
    ],
    'c-feedback:1': [
      ['p27', 1 * D + 280, 'I checked the telemetry: 340 customers have manually copied dispatch history out of the UI in the last month. CSV export is clearly wanted.'],
      ['p1', 1 * D + 270, 'That is a much stronger number than eleven tickets. Thanks Grace.'],
      ['p25', 1 * D + 250, 'It is small — maybe three days of work including permissions.'],
      ['p1', 1 * D + 240, 'Then let us do it as a fast-follow with usage-based billing.']
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Files                                                              */
  /* ------------------------------------------------------------------ */
  const FOLDERS = [
    { id: 'fo-apollo', name: 'Project Apollo', parentId: null, color: '#12a583', ownerId: 'p1' },
    { id: 'fo-design', name: 'Design', parentId: null, color: '#d946ef', ownerId: 'p4' },
    { id: 'fo-launch', name: 'Launch — April', parentId: null, color: '#ff7a45', ownerId: 'p28' },
    { id: 'fo-people', name: 'People & Policies', parentId: null, color: '#8b5cf6', ownerId: 'p8' },
    { id: 'fo-eng', name: 'Engineering Docs', parentId: null, color: '#2e7cf6', ownerId: 'p3' },
    { id: 'fo-sales', name: 'Sales Enablement', parentId: null, color: '#eab308', ownerId: 'p5' },
    { id: 'fo-finance', name: 'Finance', parentId: null, color: '#17a34a', ownerId: 'p7' },
    { id: 'fo-specs', name: 'Specs', parentId: 'fo-apollo', color: '#12a583', ownerId: 'p1' }
  ];

  const RAW_FILES = [
    ['f-rfc','Apollo Routing RFC v3.pdf', 2_410_000,'p10','fo-specs', 2*D+60,'c-engineering', true],
    ['f-loadtest','Apollo Load Test Results — 3x Peak.xlsx', 890_000,'p10','fo-apollo', 300,'c-apollo', true],
    ['f-dispatch-board','Dispatch Board v4.fig', 18_400_000,'p21','fo-design', 2*D+400,'c-design', true],
    ['f-architecture','Apollo Architecture Overview.pdf', 3_900_000,'p10','fo-apollo', 4*D,'c-apollo', true],
    ['f-research','Dispatcher Interviews — Synthesis.docx', 1_240_000,'p23','fo-design', 1*D+400,'c-design', false],
    ['f-beta-metrics','Apollo Beta Metrics — Week 6.xlsx', 1_600_000,'p27','fo-apollo', 200,'c-apollo', true],
    ['f-launch-checklist','Launch Checklist — 12 April.xlsx', 420_000,'p28','fo-launch', 1*D,'c-launch', true],
    ['f-blog-draft','Apollo GA — Blog Draft.docx', 310_000,'p29','fo-launch', 1*D+200,'c-marketing', false],
    ['f-launch-creative','Launch Creative Set.zip', 64_800_000,'p24','fo-launch', 200,'c-marketing', false],
    ['f-battlecards','Apollo Battlecards.pptx', 8_200_000,'p5','fo-sales', 1*D,'c-launch', false],
    ['f-soc2','Northbeam SOC 2 Type II Report.pdf', 5_100_000,'p43','fo-sales', 1*D+100,'c-sales', true],
    ['f-series-c','Series C Announcement + FAQ.pdf', 2_800_000,'p2','fo-people', 15*D,'c-announcements', true],
    ['f-remote-policy','Remote Working Policy 2026.pdf', 740_000,'p8','fo-people', 8*D,'c-announcements', true],
    ['f-benefits','Benefits Guide 2026.pdf', 3_300_000,'p40','fo-people', 2*D,'c-people-ops', false],
    ['f-allhands','Q1 All-Hands Deck.pptx', 22_600_000,'p2','fo-people', 600,'c-announcements', false],
    ['f-postmortem','Postmortem — EU-West 5xx.docx', 280_000,'p14','fo-eng', 2*D+60,'c-incidents', false],
    ['f-runbook','Apollo GA Day Runbook.docx', 460_000,'p14','fo-apollo', 8,'c-apollo', true],
    ['f-testreport','RC3 Test Report.pdf', 1_100_000,'p19','fo-eng', 12,'c-engineering', false],
    ['f-copy-strings','Apollo UI Strings.csv', 96_000,'p21','fo-specs', 1*D+30,'g-apollo', false],
    ['f-illustrations','Empty State Illustrations — 3 Directions.fig', 26_700_000,'p46','fo-design', 80,'c-design', false],
    ['f-onsite-brand','Lisbon Onsite Brand Kit.zip', 118_000_000,'p24','fo-design', 700,'c-onsite', false],
    ['f-conflict-patterns','Offline Conflict Patterns.fig', 9_400_000,'p22','fo-design', 800,'g-mobile', false],
    ['f-integrations-spec','Integrations Spec v2.docx', 620_000,'p26','fo-specs', 400,'c-product', false],
    ['f-web-direction','Website Visual Direction.pdf', 14_200_000,'p24','fo-design', 2*D+100,'c-website', false],
    ['f-board-deck','Apollo Board Summary.pptx', 6_700_000,'p1','fo-apollo', 200,'d-p2', true],
    ['f-forecast','Q2 Revenue Forecast.xlsx', 1_900_000,'p41','fo-finance', 1*D+600,'c-finance', false],
    ['f-org-chart','Northbeam Org Chart.pdf', 1_500_000,'p8','fo-people', 5*D,'c-people-ops', false],
    ['f-demo-video','Apollo Dispatch Demo.mp4', 214_000_000,'p28','fo-launch', 900,'c-launch', false],
    ['f-depot-photo','Vantage Depot Visit.jpg', 4_200_000,'p23','fo-design', 3*D,'c-feedback', false],
    ['f-board-photo','Dispatch Board — Final Screens.png', 7_800_000,'p21','fo-design', 300,'c-design', true],
    ['f-voice-note','Voice note — routing thoughts.mp3', 1_800_000,'p10','fo-apollo', 500,'d-p10', false],
    ['f-dpa','Enterprise DPA Template.docx', 340_000,'p42','fo-sales', 200,'c-security', false],
    ['f-schema','dispatch_events_schema.sql', 42_000,'p11','fo-eng', 1*D+40,'c-engineering', false],
    ['f-tokens','design-tokens.json', 78_000,'p21','fo-design', 1*D+300,'c-design', false]
  ];

  const FILES = RAW_FILES.map(function (r) {
    return {
      id: r[0], name: r[1], size: r[2], ownerId: r[3], folderId: r[4],
      createdAt: t(r[5] + 60), modifiedAt: t(r[5]), source: r[6], starred: r[7],
      sharedWith: [], versions: Math.max(1, (U.hashInt(r[0]) % 5) + 1),
      permission: r[0] === 'f-soc2' || r[0] === 'f-forecast' ? 'restricted' : 'org',
      downloads: (U.hashInt(r[0]) % 90) + 3
    };
  });

  /* ------------------------------------------------------------------ */
  /* Tasks                                                              */
  /* ------------------------------------------------------------------ */
  const RAW_TASKS = [
    ['Write the GA launch decision log','Capture every scope decision with rationale so the launch doc is auditable.','review','high','p1','p1', 2*D, ['Apollo','Launch'], 'c-apollo'],
    ['Design the "why this driver" reason popover','Compact explanation surface for automated driver assignment.','inprogress','urgent','p21','p1', 1*D, ['Apollo','Design'], 'c-apollo'],
    ['Build the reason string API','Return a short, human-readable rationale with each assignment.','inprogress','urgent','p11','p10', 2*D, ['Apollo','Backend'], 'c-apollo'],
    ['Quarantine the flaky map-tile test (QA-812)','Stub the tile CDN in the test harness.','done','medium','p19','p19', -1*D, ['QA'], 'c-apollo'],
    ['Prepare the five-slide board summary','Outcomes, not features. Draft due to Elena by the 26th.','done','high','p1','p2', -2*D, ['Leadership'], 'd-p2'],
    ['Finalise pricing page copy','Blocking the website refresh and the launch.','inprogress','high','p6','p28', 1*D, ['Launch','Website'], 'c-launch'],
    ['Write the CS in-app tour script','Five steps, skippable, resumable.','todo','high','p36','p21', 3*D, ['Launch','CS'], 'c-launch'],
    ['German translation for launch assets','Vendor delivery, then internal review.','todo','medium','p31','p28', 4*D, ['Launch','Localisation'], 'c-launch'],
    ['Partner announcement email','Send to the 14 integration partners.','todo','medium','p28','p28', 3*D, ['Launch'], 'c-launch'],
    ['Phoenix cutover dry run','Full rehearsal with rollback.','inprogress','urgent','p25','p25', 1*D, ['Phoenix'], 'c-phoenix'],
    ['Send the customer notice for the cutover','48 hours before, approved copy from Anna.','todo','high','p37','p25', 1*D, ['Phoenix','CS'], 'c-phoenix'],
    ['Complete mandatory security training','25 minutes. Due 15 April.','todo','medium','p1','p43', 5*D, ['Compliance'], 'c-security'],
    ['Quarterly access review — Product','Review access for your direct reports.','todo','medium','p1','p43', 6*D, ['Compliance'], 'c-security'],
    ['Confirm benefits enrolment','Closes Friday 18:00 WET.','todo','high','p1','p40', 2*D, ['People'], 'c-people-ops'],
    ['Book the last growth conversation','Three of four are scheduled.','todo','medium','p1','p8', 3*D, ['People'], 'd-p8'],
    ['Spec the offline conflict resolution','Keep-both with a review flag.','todo','medium','p17','p16', 4*D, ['Mobile'], 'g-mobile'],
    ['Add Vantage Freight to the Apollo beta','Design partner access after the security review.','done','high','p1','p32', -1*D, ['Sales','Apollo'], 'd-p32'],
    ['Record the failover demo','30-second clean take for the technical deep-dive.','todo','low','p10','p1', 2*D, ['Apollo','Launch'], 'd-p10'],
    ['Rate limiting design doc review','Circulate before the architecture review board.','review','medium','p13','p3', 1*D, ['Platform'], 'c-engineering'],
    ['Backfill dispatch history export spec','Small scope, three days including permissions.','todo','low','p25','p1', 8*D, ['H2','Apollo'], 'c-feedback'],
    ['Onsite: reserve the product demo slot','90 minutes on day two, main stage.','done','medium','p44','p1', -1*D, ['Onsite'], 'g-onsite'],
    ['Review the integrations spec v2','Feedback due Friday.','todo','medium','p1','p26', 2*D, ['Integrations'], 'c-product'],
    ['Baltic Haulage churn-risk call','Usage down 40% since their ops lead left.','inprogress','urgent','p37','p36', 1*D, ['CS','Risk'], 'c-feedback'],
    ['Publish the postmortem action items','Two items, both assigned, both need dates.','done','medium','p14','p3', -2*D, ['Reliability'], 'c-incidents']
  ];

  const TASKS = RAW_TASKS.map(function (r, i) {
    return {
      id: 'tk' + (i + 1), title: r[0], description: r[1], status: r[2], priority: r[3],
      assigneeId: r[4], creatorId: r[5], due: t(-r[6]), labels: r[7], source: r[8],
      createdAt: t(r[6] > 0 ? r[6] + 3 * D : 5 * D),
      subtasks: i % 4 === 0 ? [
        { id: 'st' + i + 'a', title: 'Draft the outline', done: true },
        { id: 'st' + i + 'b', title: 'Review with stakeholders', done: r[2] === 'done' },
        { id: 'st' + i + 'c', title: 'Publish and link', done: r[2] === 'done' }
      ] : [],
      comments: i % 5 === 0 ? [
        { id: 'tc' + i, authorId: r[5] === r[4] ? 'p10' : r[5], ts: t(200), text: 'Flagging this as the critical path item for the week.' }
      ] : []
    };
  });

  /* ------------------------------------------------------------------ */
  /* Meetings & calendar                                                */
  /* ------------------------------------------------------------------ */
  const RAW_MEETINGS = [
    ['Apollo GA go/no-go','p1',['p1','p3','p6','p10','p19','p21','p25','p28','p36','p5'], 55, 45,'decision', 'Final decision on the 12 April GA date.', true],
    ['Daily standup — Apollo','p10',['p1','p10','p11','p12','p13','p19','p21'], -180, 15,'recurring','Fifteen minutes, blockers only.', false],
    ['Design crit','p21',['p21','p22','p23','p24','p4','p1','p46'], 300, 60,'recurring','Dispatch board v4, reason popover, empty state illustrations.', false],
    ['Product & Design leads sync','p6',['p1','p6','p4','p21','p25','p26','p23'], 1500, 45,'recurring','GA readiness, H2 themes, design systems case.', false],
    ['Phoenix cutover','p25',['p25','p41','p7','p20','p15','p1'], 2200, 90,'critical','Billing platform cutover with rollback rehearsal.', true],
    ['1:1 Aarav / Rachel','p6',['p1','p6'], 480, 30,'oneonone','', false],
    ['1:1 Aarav / Priya','p1',['p1','p10'], 1320, 30,'oneonone','', false],
    ['Vantage Freight onboarding kickoff','p37',['p37','p32','p1','p33'], 1600, 60,'external','First session with the new enterprise account.', false],
    ['Engineering architecture review board','p3',['p3','p10','p13','p11','p14','p20','p1'], 2800, 60,'recurring','Routing RFC and rate limiting.', false],
    ['All-hands — Q2 kickoff','p2', allIds, 4300, 60,'company','Quarterly kickoff for the whole company.', true],
    ['Dispatcher research session 3','p23',['p23','p21','p1'], 3100, 45,'research','Third of five sessions this week.', false],
    ['Launch war room daily','p28',['p1','p28','p6','p5','p36','p3','p21'], 1200, 30,'recurring','Burn-down of the launch checklist.', false],
    ['Interview — Senior Platform Engineer','p13',['p13','p39','p14'], 2000, 60,'interview','Systems design round.', false],
    ['Benefits Q&A drop-in','p40', allIds, 900, 30,'optional','Open session before enrolment closes.', false],
    ['Onsite planning sync','p44',['p44','p8','p40','p28','p24','p1'], 3600, 30,'recurring','', false],
    ['Board meeting prep','p2',['p2','p7','p3','p6','p1'], 5200, 90,'leadership','Walk through the deck before the 30th.', false]
  ];

  const MEETINGS = RAW_MEETINGS.map(function (r, i) {
    const startMs = NOW + r[3] * 60000;
    return {
      id: 'mt' + (i + 1), title: r[0], organizerId: r[1], participantIds: r[2],
      start: new Date(startMs).toISOString(), end: new Date(startMs + r[4] * 60000).toISOString(),
      durationMin: r[4], type: r[5], description: r[6], recording: r[7],
      location: i % 3 === 0 ? 'iThrive Meeting' : (i % 3 === 1 ? 'iThrive Meeting' : 'Lisbon HQ — Tagus Room'),
      link: 'https://meet.ithrive.app/' + r[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24),
      lobby: i % 2 === 0, recurringRule: r[5] === 'recurring' ? 'Every weekday' : null,
      agenda: r[5] === 'decision' ? ['Readiness review by function', 'Open risks', 'Go / no-go vote', 'Comms plan'] :
              r[5] === 'recurring' ? ['Yesterday', 'Today', 'Blockers'] : [],
      rsvp: {}, status: r[3] < 0 ? 'ended' : (r[3] < 10 ? 'live' : 'scheduled')
    };
  });

  const PERSONAL_EVENTS = [
    { id: 'ev1', title: 'Focus block — launch doc', start: fwd(120), end: fwd(240), type: 'focus', ownerId: 'p1' },
    { id: 'ev2', title: 'Lunch', start: fwd(1000), end: fwd(1060), type: 'personal', ownerId: 'p1' },
    { id: 'ev3', title: 'Gym', start: fwd(-400), end: fwd(-340), type: 'personal', ownerId: 'p1' },
    { id: 'ev4', title: 'Company holiday — Liberation Day', start: fwd(38 * H), end: fwd(62 * H), type: 'company', allDay: true, ownerId: 'org' },
    { id: 'ev5', title: 'Apollo GA — public launch', start: fwd(60 * H), end: fwd(61 * H), type: 'company', ownerId: 'org' }
  ];

  /* ------------------------------------------------------------------ */
  /* Calls                                                              */
  /* ------------------------------------------------------------------ */
  const CALLS = [
    { id: 'cl1', kind: 'video', direction: 'out', peerIds: ['p10'], start: t(300), durationSec: 1840, missed: false, recorded: true },
    { id: 'cl2', kind: 'audio', direction: 'in', peerIds: ['p21'], start: t(640), durationSec: 420, missed: false, recorded: false },
    { id: 'cl3', kind: 'video', direction: 'in', peerIds: ['p3'], start: t(1 * D + 40), durationSec: 0, missed: true, recorded: false },
    { id: 'cl4', kind: 'video', direction: 'out', peerIds: ['p25','p41','p7'], start: t(1 * D + 300), durationSec: 3120, missed: false, recorded: true },
    { id: 'cl5', kind: 'audio', direction: 'out', peerIds: ['p32'], start: t(2 * D), durationSec: 610, missed: false, recorded: false },
    { id: 'cl6', kind: 'video', direction: 'in', peerIds: ['p6'], start: t(2 * D + 400), durationSec: 1720, missed: false, recorded: false },
    { id: 'cl7', kind: 'audio', direction: 'in', peerIds: ['p46'], start: t(3 * D), durationSec: 0, missed: true, recorded: false },
    { id: 'cl8', kind: 'video', direction: 'out', peerIds: ['p13'], start: t(3 * D + 200), durationSec: 900, missed: false, recorded: false },
    { id: 'cl9', kind: 'video', direction: 'in', peerIds: ['p19','p10','p12'], start: t(4 * D), durationSec: 2410, missed: false, recorded: true },
    { id: 'cl10', kind: 'audio', direction: 'out', peerIds: ['p8'], start: t(5 * D), durationSec: 300, missed: false, recorded: false },
    { id: 'cl11', kind: 'video', direction: 'in', peerIds: ['p28'], start: t(30), durationSec: 0, missed: true, recorded: false },
    { id: 'cl12', kind: 'video', direction: 'out', peerIds: ['p27'], start: t(900), durationSec: 1500, missed: false, recorded: false }
  ];

  /* ------------------------------------------------------------------ */
  /* Announcements                                                      */
  /* ------------------------------------------------------------------ */
  const ANNOUNCEMENTS = [
    { id: 'an1', title: 'Northbeam raises a $42M Series C', body: 'We have closed a $42M Series C led by Arbor Capital, with participation from every existing investor.\n\nThis gives us four years of runway at the current burn and lets us accelerate three things: the platform roadmap, our European expansion, and the customer success organisation.\n\nThank you for the work that made this possible. There is an FAQ attached covering the questions we expect, including what this means for equity and hiring.', authorId: 'p2', audience: 'Everyone', type: 'Company', createdAt: t(15 * D), pinned: true, requireRead: true, readBy: allIds.slice(0, 39), attachments: ['f-series-c'], priority: 'normal' },
    { id: 'an2', title: 'Updated remote working policy', body: 'The 2026 remote working policy is now in effect.\n\nThe headline change is that core collaboration hours are 14:00–17:00 CET. Outside those hours, work is genuinely asynchronous and nobody should expect an immediate reply.\n\nWe have also raised the home office stipend and clarified the process for working from another country.', authorId: 'p8', audience: 'Everyone', type: 'Policy', createdAt: t(8 * D), pinned: true, requireRead: true, readBy: allIds.slice(0, 41), attachments: ['f-remote-policy'], priority: 'normal' },
    { id: 'an3', title: 'Mandatory security training — due 15 April', body: 'All employees and contractors must complete the annual security training by 15 April.\n\nIt takes about 25 minutes. Non-completion will result in restricted access to production systems until it is done. Current completion is 71%.', authorId: 'p43', audience: 'Everyone', type: 'Policy', createdAt: t(4 * D), pinned: false, requireRead: true, readBy: allIds.slice(0, 33), attachments: [], priority: 'high' },
    { id: 'an4', title: 'Apollo GA launches 12 April', body: 'Apollo reaches general availability on 12 April at 09:00 CET.\n\nThe press embargo lifts at the same moment. Please do not post about it publicly before then, including on personal accounts.\n\nSales and CS: enablement material is in the Files hub under Launch — April.', authorId: 'p28', audience: 'Everyone', type: 'Event', createdAt: t(120), pinned: true, requireRead: false, readBy: allIds.slice(0, 22), attachments: [], priority: 'normal' },
    { id: 'an5', title: 'Lisbon office — electrical works Thursday', body: 'The electrical works in the Lisbon office begin on Thursday and will run for two days.\n\nDesk space on level 3 will be unavailable and there may be intermittent noise on levels 1 and 2. Working remotely on those days is encouraged.', authorId: 'p44', audience: 'Lisbon office', type: 'Department', createdAt: t(1 * D + 200), pinned: false, requireRead: false, readBy: allIds.slice(0, 18), attachments: [], priority: 'normal' },
    { id: 'an6', title: 'Benefits enrolment closes Friday', body: 'Benefits enrolment for 2026 closes on Friday at 18:00 WET.\n\nIf you take no action your current selections carry over. New this year: expanded mental health cover and an increased home office stipend.', authorId: 'p40', audience: 'Everyone', type: 'Department', createdAt: t(2 * D), pinned: false, requireRead: true, readBy: allIds.slice(0, 29), attachments: ['f-benefits'], priority: 'normal' },
    { id: 'an7', title: 'Scheduled: Q2 all-hands on 2 May', body: 'The Q2 all-hands is scheduled for 2 May at 16:00 CET. Calendar invitations will go out on Monday.\n\nThis announcement is scheduled to publish on 25 April.', authorId: 'p2', audience: 'Everyone', type: 'Event', createdAt: t(60), scheduledFor: fwd(30 * D), pinned: false, requireRead: false, readBy: [], attachments: [], priority: 'normal', draft: true }
  ];

  /* ------------------------------------------------------------------ */
  /* Notifications                                                      */
  /* ------------------------------------------------------------------ */
  const NOTIFICATIONS = [
    { id: 'n1', type: 'mention', actorId: 'p21', ts: t(12), target: { kind: 'channel', id: 'c-apollo' }, text: 'mentioned you in #project-apollo', preview: 'Aarav, can you confirm the reason popover copy before the crit?', read: false },
    { id: 'n2', type: 'message', actorId: 'p10', ts: t(6), target: { kind: 'dm', id: 'd-p10' }, text: 'sent you a direct message', preview: 'Perfect. I can record a clean take tomorrow morning your time.', read: false },
    { id: 'n3', type: 'task', actorId: 'p43', ts: t(40), target: { kind: 'task', id: 'tk12' }, text: 'assigned you a task', preview: 'Complete mandatory security training', read: false },
    { id: 'n4', type: 'meeting', actorId: 'p1', ts: t(55), target: { kind: 'meeting', id: 'mt1' }, text: 'Apollo GA go/no-go starts in 55 minutes', preview: '10 participants · iThrive Meeting', read: false },
    { id: 'n5', type: 'reaction', actorId: 'p3', ts: t(20), target: { kind: 'channel', id: 'c-apollo' }, text: 'reacted ✅ to your message', preview: 'Decision recorded: usage-based billing moves to a fast-follow', read: false },
    { id: 'n6', type: 'call', actorId: 'p28', ts: t(30), target: { kind: 'dm', id: 'd-p28' }, text: 'missed video call', preview: 'Camille Rousseau tried to reach you', read: false },
    { id: 'n7', type: 'file', actorId: 'p14', ts: t(8), target: { kind: 'file', id: 'f-runbook' }, text: 'shared a file with you', preview: 'Apollo GA Day Runbook.docx', read: false },
    { id: 'n8', type: 'announcement', actorId: 'p28', ts: t(120), target: { kind: 'announcement', id: 'an4' }, text: 'posted an announcement', preview: 'Apollo GA launches 12 April', read: true },
    { id: 'n9', type: 'thread', actorId: 'p13', ts: t(150), target: { kind: 'channel', id: 'c-engineering' }, text: 'replied in a thread you follow', preview: 'Also worth documenting what happens if the routing service is down', read: true },
    { id: 'n10', type: 'invite', actorId: 'p44', ts: t(200), target: { kind: 'channel', id: 'c-onsite' }, text: 'added you to #lisbon-onsite-2026', preview: 'Temporary channel for the May onsite', read: true },
    { id: 'n11', type: 'mention', actorId: 'p23', ts: t(60), target: { kind: 'channel', id: 'c-feedback' }, text: 'mentioned you in #customer-feedback', preview: 'The explainability finding matches what CS hears.', read: true },
    { id: 'n12', type: 'task', actorId: 'p26', ts: t(400), target: { kind: 'task', id: 'tk22' }, text: 'assigned you a task', preview: 'Review the integrations spec v2', read: true },
    { id: 'n13', type: 'group', actorId: 'p28', ts: t(45), target: { kind: 'group', id: 'g-launch-war' }, text: 'posted in Launch War Room', preview: 'Go/no-go tomorrow at 15:00 CET.', read: false },
    { id: 'n14', type: 'reaction', actorId: 'p10', ts: t(300), target: { kind: 'channel', id: 'c-apollo' }, text: 'reacted 🎉 to your message', preview: 'Load test results: p95 412ms at 3x peak traffic', read: true },
    { id: 'n15', type: 'meeting', actorId: 'p6', ts: t(480), target: { kind: 'meeting', id: 'mt6' }, text: 'accepted your meeting invitation', preview: '1:1 Aarav / Rachel', read: true },
    { id: 'n16', type: 'file', actorId: 'p46', ts: t(80), target: { kind: 'file', id: 'f-illustrations' }, text: 'shared a file in #design', preview: 'Empty State Illustrations — 3 Directions.fig', read: true },
    { id: 'n17', type: 'message', actorId: 'p8', ts: t(20), target: { kind: 'dm', id: 'd-p8' }, text: 'sent you a direct message', preview: 'Congratulations on the Apollo load test numbers.', read: false },
    { id: 'n18', type: 'announcement', actorId: 'p43', ts: t(4 * D), target: { kind: 'announcement', id: 'an3' }, text: 'posted an announcement requiring confirmation', preview: 'Mandatory security training — due 15 April', read: true }
  ];

  /* ------------------------------------------------------------------ */
  /* Integrations                                                       */
  /* ------------------------------------------------------------------ */
  const INTEGRATIONS = [
    { id: 'i-gdrive', name: 'Google Drive', category: 'Storage', desc: 'Attach and preview Drive files without leaving a conversation.', connected: true, color: '#17a34a', glyph: 'folder', scopes: ['Read file metadata', 'Create sharing links'], installs: 412, connectedBy: 'p43', connectedAt: t(120 * D) },
    { id: 'i-onedrive', name: 'OneDrive', category: 'Storage', desc: 'Bring OneDrive and SharePoint documents into channels.', connected: true, color: '#2e7cf6', glyph: 'cloud', scopes: ['Read file metadata', 'Create sharing links'], installs: 388, connectedBy: 'p43', connectedAt: t(120 * D) },
    { id: 'i-dropbox', name: 'Dropbox', category: 'Storage', desc: 'Share Dropbox folders and get change notifications.', connected: false, color: '#0ea5b7', glyph: 'archive', scopes: ['Read file metadata'], installs: 96 },
    { id: 'i-gcal', name: 'Google Calendar', category: 'Calendar', desc: 'Two-way calendar sync, availability and one-click join.', connected: true, color: '#e5484d', glyph: 'calendar', scopes: ['Read/write events', 'Read free-busy'], installs: 461, connectedBy: 'p43', connectedAt: t(200 * D) },
    { id: 'i-mscal', name: 'Microsoft Calendar', category: 'Calendar', desc: 'Sync Outlook calendars and meeting rooms.', connected: false, color: '#2e7cf6', glyph: 'calendar', scopes: ['Read/write events'], installs: 274 },
    { id: 'i-github', name: 'GitHub', category: 'Engineering', desc: 'Pull request, deploy and CI notifications in channels.', connected: true, color: '#64748b', glyph: 'code', scopes: ['Read repositories', 'Post webhooks'], installs: 203, connectedBy: 'p3', connectedAt: t(300 * D) },
    { id: 'i-jira', name: 'Jira', category: 'Project', desc: 'Create and update issues from any message.', connected: true, color: '#2e7cf6', glyph: 'tasks', scopes: ['Read/write issues'], installs: 187, connectedBy: 'p25', connectedAt: t(150 * D) },
    { id: 'i-trello', name: 'Trello', category: 'Project', desc: 'Turn messages into cards and watch boards.', connected: false, color: '#0ea5b7', glyph: 'layout', scopes: ['Read/write cards'], installs: 71 },
    { id: 'i-asana', name: 'Asana', category: 'Project', desc: 'Sync tasks between Asana projects and iThrive tasks.', connected: false, color: '#e5484d', glyph: 'listChecks', scopes: ['Read/write tasks'], installs: 88 },
    { id: 'i-zoom', name: 'Zoom', category: 'Meetings', desc: 'Start Zoom meetings from a channel or DM.', connected: false, color: '#2e7cf6', glyph: 'video', scopes: ['Create meetings'], installs: 156 },
    { id: 'i-salesforce', name: 'Salesforce', category: 'CRM', desc: 'Deal alerts, account lookups and win notifications.', connected: true, color: '#0ea5b7', glyph: 'briefcase', scopes: ['Read opportunities', 'Read accounts'], installs: 119, connectedBy: 'p5', connectedAt: t(180 * D) },
    { id: 'i-hubspot', name: 'HubSpot', category: 'CRM', desc: 'Marketing and lifecycle events in your channels.', connected: false, color: '#ff7a45', glyph: 'megaphone', scopes: ['Read contacts'], installs: 64 },
    { id: 'i-workday', name: 'Workday', category: 'HR', desc: 'Sync the employee directory, org chart and time off.', connected: true, color: '#8b5cf6', glyph: 'users', scopes: ['Read directory', 'Read absence'], installs: 97, connectedBy: 'p8', connectedAt: t(240 * D) },
    { id: 'i-bamboo', name: 'BambooHR', category: 'HR', desc: 'Directory sync for smaller HR stacks.', connected: false, color: '#17a34a', glyph: 'users', scopes: ['Read directory'], installs: 42 },
    { id: 'i-pagerduty', name: 'PagerDuty', category: 'Engineering', desc: 'Route incidents into a war room channel automatically.', connected: true, color: '#17a34a', glyph: 'alertTriangle', scopes: ['Read incidents', 'Acknowledge'], installs: 78, connectedBy: 'p14', connectedAt: t(90 * D) },
    { id: 'i-figma', name: 'Figma', category: 'Design', desc: 'Live previews of frames and prototype links.', connected: true, color: '#d946ef', glyph: 'palette', scopes: ['Read files'], installs: 134, connectedBy: 'p4', connectedAt: t(160 * D) },
    { id: 'i-looker', name: 'Looker', category: 'Analytics', desc: 'Schedule dashboards into channels.', connected: false, color: '#eab308', glyph: 'chart', scopes: ['Read dashboards'], installs: 39 },
    { id: 'i-docusign', name: 'DocuSign', category: 'Legal', desc: 'Send and track signatures from a conversation.', connected: false, color: '#eab308', glyph: 'fileText', scopes: ['Send envelopes'], installs: 51 }
  ];

  /* ------------------------------------------------------------------ */
  /* Admin: audit log, sessions, invitations                            */
  /* ------------------------------------------------------------------ */
  const AUDIT = [
    { id: 'au1', ts: t(25), actorId: 'p43', action: 'security.policy.updated', target: 'Password policy — minimum length 14', ip: '81.193.44.10', severity: 'high' },
    { id: 'au2', ts: t(90), actorId: 'p8', action: 'user.invited', target: 'lena.fischer@northbeam.io — Engineering', ip: '85.240.19.7', severity: 'normal' },
    { id: 'au3', ts: t(210), actorId: 'p1', action: 'channel.created', target: '#project-apollo', ip: '49.207.11.90', severity: 'normal' },
    { id: 'au4', ts: t(320), actorId: 'p43', action: 'user.suspended', target: 'contractor.temp@northbeam.io', ip: '81.193.44.10', severity: 'high' },
    { id: 'au5', ts: t(400), actorId: 'p3', action: 'role.changed', target: 'Amara Okafor → Manager', ip: '104.28.6.11', severity: 'normal' },
    { id: 'au6', ts: t(1 * D), actorId: 'p43', action: 'integration.connected', target: 'PagerDuty', ip: '81.193.44.10', severity: 'normal' },
    { id: 'au7', ts: t(1 * D + 200), actorId: 'p42', action: 'file.permission.changed', target: 'Enterprise DPA Template.docx → Restricted', ip: '178.43.9.221', severity: 'normal' },
    { id: 'au8', ts: t(1 * D + 600), actorId: 'p2', action: 'announcement.published', target: 'Q1 all-hands recording', ip: '85.240.19.7', severity: 'normal' },
    { id: 'au9', ts: t(2 * D), actorId: 'p43', action: 'login.failed', target: 'unknown@northbeam.io — 5 attempts', ip: '203.0.113.42', severity: 'critical' },
    { id: 'au10', ts: t(2 * D + 300), actorId: 'p43', action: 'device.revoked', target: 'iPhone 14 — Sam Patel', ip: '81.193.44.10', severity: 'high' },
    { id: 'au11', ts: t(3 * D), actorId: 'p8', action: 'user.deactivated', target: 'former.employee@northbeam.io', ip: '85.240.19.7', severity: 'high' },
    { id: 'au12', ts: t(3 * D + 400), actorId: 'p7', action: 'export.requested', target: 'Finance channel export — 90 days', ip: '198.51.100.7', severity: 'normal' },
    { id: 'au13', ts: t(4 * D), actorId: 'p43', action: 'sso.config.updated', target: 'Okta SAML — certificate rotated', ip: '81.193.44.10', severity: 'high' },
    { id: 'au14', ts: t(5 * D), actorId: 'p2', action: 'workspace.settings.updated', target: 'Guest access — external file sharing disabled', ip: '85.240.19.7', severity: 'high' }
  ];

  const SESSIONS = [
    { id: 's1', device: 'MacBook Pro 16"', os: 'macOS 15.3', browser: 'iThrive Desktop', location: 'Bengaluru, India', ip: '49.207.11.90', last: t(1), current: true },
    { id: 's2', device: 'iPhone 15 Pro', os: 'iOS 18.2', browser: 'iThrive Mobile', location: 'Bengaluru, India', ip: '49.207.11.90', last: t(40), current: false },
    { id: 's3', device: 'iPad Air', os: 'iPadOS 18.1', browser: 'Safari', location: 'Bengaluru, India', ip: '106.51.30.4', last: t(3 * D), current: false },
    { id: 's4', device: 'Windows Workstation', os: 'Windows 11', browser: 'Edge 132', location: 'Lisbon, Portugal', ip: '85.240.19.7', last: t(9 * D), current: false }
  ];

  const INVITATIONS = [
    { id: 'iv1', email: 'lena.fischer@northbeam.io', name: 'Lena Fischer', deptId: 'engineering', role: 'Employee', invitedBy: 'p8', sentAt: t(90), status: 'pending' },
    { id: 'iv2', email: 'omar.haddad@northbeam.io', name: 'Omar Haddad', deptId: 'sales', role: 'Employee', invitedBy: 'p5', sentAt: t(1 * D), status: 'pending' },
    { id: 'iv3', email: 'jess.turner@vantagefreight.com', name: 'Jess Turner', deptId: null, role: 'Guest', invitedBy: 'p37', sentAt: t(2 * D), status: 'pending' },
    { id: 'iv4', email: 'marco.silva@northbeam.io', name: 'Marco Silva', deptId: 'success', role: 'Employee', invitedBy: 'p36', sentAt: t(4 * D), status: 'expired' },
    { id: 'iv5', email: 'nina.petrova@northbeam.io', name: 'Nina Petrova', deptId: 'design', role: 'Employee', invitedBy: 'p4', sentAt: t(6 * D), status: 'accepted' }
  ];

  /* ------------------------------------------------------------------ */
  /* Analytics series                                                   */
  /* ------------------------------------------------------------------ */
  const ANALYTICS = {
    dau: [318, 344, 361, 352, 379, 188, 141, 366, 388, 401, 394, 412, 205, 158, 398, 421, 433, 428, 441, 219, 167, 436, 452, 461, 448, 469, 231, 174],
    messages: [4210, 4680, 5120, 4890, 5340, 1210, 890, 5010, 5620, 5980, 5740, 6210, 1420, 980, 6080, 6440, 6810, 6520, 7010, 1580, 1090, 6720, 7180, 7420, 7080, 7640, 1710, 1180],
    meetingHours: [212, 238, 251, 244, 266, 41, 22, 258, 274, 289, 281, 302, 48, 26, 294, 311, 328, 318, 341, 53, 31, 322, 348, 361, 352, 374, 58, 34],
    calls: [86, 94, 101, 97, 112, 14, 8, 104, 118, 126, 121, 134, 17, 11, 128, 139, 147, 142, 156, 19, 12, 144, 158, 166, 159, 172, 21, 14],
    files: [142, 158, 171, 164, 182, 21, 13, 175, 192, 204, 198, 214, 25, 16, 208, 221, 234, 228, 246, 29, 18, 236, 252, 264, 256, 274, 32, 20],
    topChannels: [
      { id: 'c-apollo', messages: 4820, members: 13, growth: 34 },
      { id: 'c-engineering', messages: 3910, members: 16, growth: 12 },
      { id: 'c-general', messages: 2640, members: 47, growth: 4 },
      { id: 'c-launch', messages: 2180, members: 13, growth: 68 },
      { id: 'c-design', messages: 1970, members: 9, growth: 18 },
      { id: 'c-feedback', messages: 1420, members: 12, growth: 22 },
      { id: 'c-sales', messages: 1180, members: 8, growth: -6 }
    ],
    topTeams: [
      { name: 'Fleet Intelligence', messages: 5210, meetings: 148, files: 212 },
      { name: 'Core Platform', messages: 4680, meetings: 132, files: 186 },
      { name: 'Product Design', messages: 3920, meetings: 96, files: 341 },
      { name: 'Enterprise Sales', messages: 3110, meetings: 214, files: 128 },
      { name: 'Growth', messages: 2440, meetings: 74, files: 164 }
    ],
    responseTime: { median: 7, p90: 42, unit: 'min' },
    storageByType: [
      { label: 'Video', value: 312, color: '#0ea5b7' },
      { label: 'Documents', value: 204, color: '#2e7cf6' },
      { label: 'Design files', value: 128, color: '#d946ef' },
      { label: 'Images', value: 74, color: '#7c5cff' },
      { label: 'Archives', value: 24, color: '#64748b' }
    ]
  };

  /* ------------------------------------------------------------------ */
  const GIFS = [
    { id: 'gf1', label: 'Shipping it', grad: 'linear-gradient(135deg,#12a583,#0b6e59)', emoji: '🚢' },
    { id: 'gf2', label: 'Applause', grad: 'linear-gradient(135deg,#7c5cff,#5330c0)', emoji: '👏' },
    { id: 'gf3', label: 'Mind blown', grad: 'linear-gradient(135deg,#ff7a45,#c2451a)', emoji: '🤯' },
    { id: 'gf4', label: 'Party', grad: 'linear-gradient(135deg,#eab308,#b45309)', emoji: '🎉' },
    { id: 'gf5', label: 'This is fine', grad: 'linear-gradient(135deg,#e5484d,#9f2d31)', emoji: '🔥' },
    { id: 'gf6', label: 'Thumbs up', grad: 'linear-gradient(135deg,#2e7cf6,#164ea9)', emoji: '👍' },
    { id: 'gf7', label: 'Deploying', grad: 'linear-gradient(135deg,#0ea5b7,#0b6d7a)', emoji: '🚀' },
    { id: 'gf8', label: 'Coffee first', grad: 'linear-gradient(135deg,#8b5cf6,#5b21b6)', emoji: '☕' },
    { id: 'gf9', label: 'Nailed it', grad: 'linear-gradient(135deg,#22c55e,#15803d)', emoji: '🎯' }
  ];

  const STICKERS = ['🎯','🚀','🎉','🔥','💡','✅','📈','🧠','🛠️','☕','🌱','🏆','🧭','⚡','🫶','🙌'];

  const EMOJI_SETS = {
    'Frequent': ['👍','🎉','❤️','😄','🙏','🔥','👀','✅','🚀','💡','😂','🙌'],
    'Smileys': ['😀','😃','😄','😁','😅','😂','🙂','😉','😊','😍','😘','😎','🤔','🤨','😐','😴','🥳','🤯','😭','😤','🤝','🫡'],
    'Work': ['💼','📈','📉','📊','🗓️','⏰','✅','❌','📌','📎','🖇️','📝','🔍','🧭','🎯','⚙️','🛠️','🧪','🧱','🔐'],
    'Objects': ['💻','📱','🖥️','⌨️','🖱️','☕','🍕','🌮','🎧','📷','🎬','🏆','🎁','🌱','🚀','🛰️'],
    'Symbols': ['✅','❗','❓','💯','⚡','♻️','🔔','🔕','⭐','✨','🚩','🟢','🟡','🔴','🔵','⚪']
  };

  g.DATA = {
    NOW, t, fwd, ORG, WORKSPACES, DEPARTMENTS, TEAMS, PEOPLE, PMAP, ME,
    CHANNELS, GROUPS, DMS, SCRIPTS, THREAD_SCRIPTS, FOLDERS, FILES, TASKS,
    MEETINGS, PERSONAL_EVENTS, CALLS, ANNOUNCEMENTS, NOTIFICATIONS,
    INTEGRATIONS, AUDIT, SESSIONS, INVITATIONS, ANALYTICS, GIFS, STICKERS, EMOJI_SETS
  };
})(window);
