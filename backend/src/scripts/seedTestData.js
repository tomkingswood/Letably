/**
 * Seed Test Data Script
 *
 * Populates an agency with comprehensive, realistic test data.
 * Deletes existing seeded data then re-inserts, so it's always clean on re-run.
 *
 * Uses a seeded PRNG so output is deterministic across runs.
 *
 * Data created:
 *   - 1 admin + 10 landlord users + 200 tenant users
 *   - 10 landlords
 *   - 50 properties with ~130 bedrooms
 *   - ~60 applications (all statuses)
 *   - ~330 tenancies (30+ active, 300+ expired)
 *   - ~660 tenancy members
 *   - Payment schedules for active + recently expired tenancies
 *   - 20 maintenance requests with comments
 *
 * Usage: npm run seed:testdata [agency-slug]
 *   e.g. npm run seed:testdata steel-city-living
 *   Defaults to "test" if no slug provided.
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Seeded PRNG (deterministic across runs) ───────────────────
let _seed = 42;
function rand() { _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff; return _seed / 0x7fffffff; }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ─── Name / address pools ──────────────────────────────────────
const MALE_NAMES = ['James','Liam','Noah','Mason','Lucas','Jack','Harry','George','Oliver','William','Thomas','Daniel','Ethan','Alexander','Benjamin','Samuel','Joseph','Matthew','Ryan','Charlie','Oscar','Archie','Jake','Leo','Max','Freddie','Henry','Toby','Sebastian','Isaac'];
const FEMALE_NAMES = ['Emma','Olivia','Ava','Sophia','Ruby','Chloe','Isla','Mia','Emily','Charlotte','Amelia','Grace','Lily','Freya','Ella','Jessica','Eleanor','Hannah','Daisy','Florence','Alice','Lucy','Phoebe','Evie','Rosie','Scarlett','Poppy','Holly','Millie','Zara'];
const LAST_NAMES = ['Johnson','Williams','Brown','Taylor','Martinez','Anderson','Thomas','Jackson','Walker','Harris','Clark','Lewis','Robinson','Wright','Thompson','White','Hall','Allen','Young','King','Scott','Adams','Baker','Nelson','Hill','Campbell','Mitchell','Roberts','Carter','Phillips','Evans','Turner','Collins','Stewart','Morris','Rogers','Reed','Cook','Morgan','Bell','Murphy','Bailey','Cooper','Richardson','Cox','Howard','Ward','Brooks','Gray','Watson'];
const STREETS = ['Broomhall Street','Crookesmoor Road','Sharrow Vale Road','Glossop Road','Abbeydale Road','Endcliffe Crescent','Fulwood Road','Cemetery Road','Ecclesall Road','London Road','Division Street','West Street','Devonshire Street','Mappin Street','Broad Lane','Brook Hill','Portobello Street','Netherthorpe Road','Psalter Lane','Brocco Bank','Hunter House Road','Botanical Road','Clarkehouse Road','Meersbrook Park Road','Chesterfield Road','Woodseats Road','Abbeydale Road South','Norton Lees Road','Nether Edge Road','Montgomery Road','Wolseley Road','Rustlings Road','Oakbrook Road','Ranmoor Park Road','Graham Road','Newbould Lane','Bingham Park Road','Hangingwater Road','Ringinglow Road','Steel Bank','Clarence Street','Norfolk Street','Surrey Street','Carver Street','Arundel Street','Infirmary Road','Penistone Road','Langsett Road','Hillsborough Barracks','Middlewood Road'];
const LOCATIONS = ['Broomhall','Crookesmoor','Sharrow Vale','City Centre','Abbeydale','Endcliffe','Fulwood','Sharrow','Ecclesall','Nether Edge','Meersbrook','Woodseats','Norton','Heeley','Hillsborough','Walkley','Crookes','Ranmoor','Hunters Bar','Highfield'];
const POSTCODES = ['S1 ','S2 ','S3 ','S6 ','S7 ','S8 ','S10 ','S11 '];
const TITLES_M = ['Mr']; const TITLES_F = ['Miss','Ms','Mrs'];
const UNIVERSITIES = ['University of Sheffield','Sheffield Hallam University'];
const COURSES = ['Computer Science','English Literature','Medicine','Law','Business Management','Architecture','Engineering','Psychology','History','Biology','Chemistry','Physics','Mathematics','Art & Design','Music','Philosophy','Sociology','Economics','Politics','Geography'];
const BANKS = ['Barclays','HSBC','Lloyds','NatWest','Monzo','Starling','Santander','Nationwide'];

async function seedTestData() {
  const client = await pool.connect();
  try {
    console.log('\n=== Seeding Test Data ===\n');
    await client.query('BEGIN');

    const agencySlug = process.argv[2] || 'test';
    const agencyResult = await client.query(`SELECT id FROM agencies WHERE slug = $1`, [agencySlug]);
    if (agencyResult.rows.length === 0) throw new Error(`Agency "${agencySlug}" not found. Create it first or check the slug.`);
    const agencyId = agencyResult.rows[0].id;
    console.log(`Found agency "${agencySlug}" (ID: ${agencyId})`);

    // ─── CLEAN ─────────────────────────────────────────────────
    console.log('Cleaning existing data...');
    await client.query(`DELETE FROM signed_documents WHERE user_id IN (SELECT id FROM users WHERE agency_id = $1)`, [agencyId]);
    await client.query(`DELETE FROM tenant_documents WHERE uploaded_by IN (SELECT id FROM users WHERE agency_id = $1)`, [agencyId]);
    await client.query(`DELETE FROM id_documents WHERE user_id IN (SELECT id FROM users WHERE agency_id = $1)`, [agencyId]);
    await client.query(`DELETE FROM export_jobs WHERE created_by IN (SELECT id FROM users WHERE agency_id = $1)`, [agencyId]);
    await client.query(`DELETE FROM tenancy_communications WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM maintenance_comments WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM maintenance_requests WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM payments WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM payment_schedules WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM tenancy_members WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM tenancies WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM applications WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM viewing_requests WHERE property_id IN (SELECT id FROM properties WHERE agency_id = $1)`, [agencyId]);
    await client.query(`DELETE FROM images WHERE property_id IN (SELECT id FROM properties WHERE agency_id = $1)`, [agencyId]);
    await client.query(`DELETE FROM bedroom_attribute_values WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM bedroom_attribute_definitions WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM bedrooms WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM property_attribute_values WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM property_attribute_definitions WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM properties WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM agreement_sections WHERE landlord_id IN (SELECT id FROM landlords WHERE agency_id = $1)`, [agencyId]);
    await client.query(`DELETE FROM landlords WHERE agency_id = $1`, [agencyId]);
    await client.query(`DELETE FROM users WHERE agency_id = $1`, [agencyId]);

    const passwordHash = await bcrypt.hash('password123', 10);

    // ─── DATE HELPERS ──────────────────────────────────────────
    const today = new Date();
    const Y = today.getFullYear();
    const M = today.getMonth();
    function d(y, m, day) {
      while (m < 0) { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      const maxDay = new Date(y, m + 1, 0).getDate();
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(day, maxDay)).padStart(2, '0')}`;
    }
    // Months between two date strings (approximate)
    function monthsBetween(d1, d2) {
      const a = new Date(d1), b = new Date(d2);
      return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    }

    // ─── DB HELPERS ────────────────────────────────────────────

    async function insertUser(email, firstName, lastName, role) {
      const r = await client.query(`INSERT INTO users (agency_id, email, password_hash, first_name, last_name, role, email_verified) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`, [agencyId, email, passwordHash, firstName, lastName, role]);
      return r.rows[0].id;
    }

    async function insertLandlord(data) {
      const r = await client.query(`INSERT INTO landlords (agency_id, name, legal_name, email, phone, address_line1, city, postcode, bank_name, bank_account_name, sort_code, account_number, manage_rent, council_tax_in_bills, receive_maintenance_notifications, receive_tenancy_communications, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [agencyId, data.name, data.legalName, data.email, data.phone, data.address, data.city, data.postcode, data.bankName, data.accountName, data.sortCode, data.accountNumber, data.manageRent, data.councilTax, data.maintNotifs, data.tenComms, data.userId]);
      return r.rows[0].id;
    }

    async function insertProperty(data) {
      const r = await client.query(`INSERT INTO properties (agency_id, address_line1, address_line2, city, postcode, location, letting_type, description, landlord_id, is_live, available_from) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [agencyId, data.address1, data.address2 || null, data.city, data.postcode, data.location || null, data.lettingType || 'Whole House', data.description || null, data.landlordId, data.isLive !== false, data.availableFrom || null]);
      return r.rows[0].id;
    }

    async function insertBedroom(propertyId, name, price, order) {
      const r = await client.query(`INSERT INTO bedrooms (agency_id, property_id, bedroom_name, price_pppw, display_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [agencyId, propertyId, name, price, order || 1]);
      return r.rows[0].id;
    }

    async function insertTenancy(data) {
      const r = await client.query(`INSERT INTO tenancies (agency_id, property_id, tenancy_type, start_date, end_date, rent_amount, status, auto_generate_payments) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [agencyId, data.propertyId, data.type, data.start, data.end || null, data.rent, data.status, data.autoPayments !== false]);
      return r.rows[0].id;
    }

    async function insertMember(data) {
      const r = await client.query(`INSERT INTO tenancy_members (agency_id, tenancy_id, bedroom_id, user_id, first_name, surname, title, current_address, application_type, rent_pppw, deposit_amount, payment_option, is_signed, signed_at, key_status, key_collection_date, key_return_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [agencyId, data.tenancyId, data.bedroomId || null, data.userId || null, data.firstName, data.surname, data.title, data.address, data.appType, data.rent, data.deposit, data.paymentOption || 'monthly', data.signed || false, data.signedAt || null, data.keyStatus || 'not_collected', data.keyCollected || null, data.keyReturned || null]);
      return r.rows[0].id;
    }

    async function insertSchedule(data) {
      const r = await client.query(`INSERT INTO payment_schedules (agency_id, tenancy_id, tenancy_member_id, payment_type, description, due_date, amount_due, status, schedule_type, covers_from, covers_to) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [agencyId, data.tenancyId, data.memberId, data.type, data.desc, data.due, data.amount, data.status || 'pending', data.schedType || 'automated', data.from || null, data.to || null]);
      return r.rows[0].id;
    }

    async function insertPayment(scheduleId, amount, paymentDate, ref) {
      await client.query(`INSERT INTO payments (agency_id, payment_schedule_id, amount, payment_date, payment_reference) VALUES ($1,$2,$3,$4,$5)`, [agencyId, scheduleId, amount, paymentDate, ref || null]);
    }

    async function insertMaintRequest(data) {
      const r = await client.query(`INSERT INTO maintenance_requests (agency_id, tenancy_id, created_by_user_id, title, description, category, priority, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [agencyId, data.tenancyId, data.userId, data.title, data.description, data.category, data.priority, data.status]);
      return r.rows[0].id;
    }

    async function insertComment(requestId, userId, type, content, oldVal, newVal, isPrivate) {
      await client.query(`INSERT INTO maintenance_comments (agency_id, request_id, user_id, comment_type, content, old_value, new_value, is_private) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [agencyId, requestId, userId, type, content || null, oldVal || null, newVal || null, isPrivate || false]);
    }

    // ═══════════════════════════════════════════════════════════
    // 1. USERS
    // ═══════════════════════════════════════════════════════════

    const adminId = await insertUser('admin@test.com', 'Admin', 'User', 'admin');

    // 10 landlord users
    const llUserIds = [];
    for (let i = 1; i <= 10; i++) {
      const isMale = i % 2 === 1;
      const fn = isMale ? MALE_NAMES[(i - 1) % MALE_NAMES.length] : FEMALE_NAMES[(i - 1) % FEMALE_NAMES.length];
      const ln = LAST_NAMES[i - 1];
      llUserIds.push(await insertUser(`landlord${i}@test.com`, fn, ln, 'landlord'));
    }

    // 200 tenant users — enough to populate all tenancies
    const tenantPool = []; // { id, firstName, lastName, title, email, address }
    for (let i = 1; i <= 200; i++) {
      const isMale = rand() < 0.5;
      const fn = isMale ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
      const ln = pick(LAST_NAMES);
      const title = isMale ? pick(TITLES_M) : pick(TITLES_F);
      const uid = await insertUser(`tenant${i}@test.com`, fn, ln, 'tenant');
      tenantPool.push({
        id: uid, firstName: fn, lastName: ln, title,
        email: `tenant${i}@test.com`,
        address: `${randInt(1, 150)} ${pick(STREETS)}, Sheffield, ${pick(POSTCODES)}${randInt(1, 9)}${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}`
      });
    }
    console.log(`Created 1 admin + 10 landlord users + ${tenantPool.length} tenant users`);

    // ═══════════════════════════════════════════════════════════
    // 2. LANDLORDS
    // ═══════════════════════════════════════════════════════════

    const landlordIds = [];
    for (let i = 0; i < 10; i++) {
      const fn = MALE_NAMES[i * 3 % MALE_NAMES.length];
      const ln = LAST_NAMES[i];
      const llId = await insertLandlord({
        name: `${fn} ${ln}`, legalName: i < 4 ? `${ln} Properties Ltd` : `${fn} ${ln}`,
        email: `landlord${i + 1}@test.com`, phone: `07700 10000${i + 1}`,
        address: `${randInt(1, 100)} ${STREETS[i]}`, city: 'Sheffield', postcode: `${pick(POSTCODES)}${randInt(1, 9)}${String.fromCharCode(65 + randInt(0, 5))}${String.fromCharCode(65 + randInt(0, 5))}`,
        bankName: BANKS[i % BANKS.length], accountName: `${fn} ${ln}`,
        sortCode: `${randInt(10, 60)}-${randInt(10, 40)}-${randInt(10, 50)}`,
        accountNumber: String(randInt(10000000, 99999999)),
        manageRent: rand() > 0.3, councilTax: rand() > 0.4,
        maintNotifs: rand() > 0.2, tenComms: rand() > 0.3,
        userId: llUserIds[i]
      });
      landlordIds.push(llId);
    }
    console.log(`Created ${landlordIds.length} landlords`);

    // ═══════════════════════════════════════════════════════════
    // 2b. PROPERTY ATTRIBUTE DEFINITIONS
    // ═══════════════════════════════════════════════════════════

    async function insertAttrDef(name, attrType, options, isRequired, order) {
      const r = await client.query(
        `INSERT INTO property_attribute_definitions (agency_id, name, attribute_type, options, is_required, display_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [agencyId, name, attrType, options ? JSON.stringify(options) : null, isRequired, order]
      );
      return r.rows[0].id;
    }

    async function insertAttrValue(propertyId, defId, valueText, valueNumber, valueBoolean) {
      await client.query(
        `INSERT INTO property_attribute_values (property_id, attribute_definition_id, agency_id, value_text, value_number, value_boolean) VALUES ($1,$2,$3,$4,$5,$6)`,
        [propertyId, defId, agencyId, valueText, valueNumber, valueBoolean]
      );
    }

    const attrPropertyType = await insertAttrDef('Property Type', 'dropdown', ['House', 'Flat', 'Apartment', 'Terraced', 'Semi-Detached', 'Detached'], false, 0);
    const attrBathrooms = await insertAttrDef('Bathrooms', 'number', null, true, 1);
    const attrCommunalAreas = await insertAttrDef('Communal Areas', 'number', null, false, 2);
    const attrHasParking = await insertAttrDef('Has Parking', 'boolean', null, false, 3);
    const attrHasGarden = await insertAttrDef('Has Garden', 'boolean', null, false, 4);
    const attrBillsIncluded = await insertAttrDef('Bills Included', 'boolean', null, false, 5);
    const attrBroadband = await insertAttrDef('Broadband Speed', 'text', null, false, 6);
    console.log('Created 7 property attribute definitions');

    // ═══════════════════════════════════════════════════════════
    // 2c. BEDROOM ATTRIBUTE DEFINITIONS
    // ═══════════════════════════════════════════════════════════

    async function insertBedroomAttrDef(name, attrType, options, isRequired, order) {
      const r = await client.query(
        `INSERT INTO bedroom_attribute_definitions (agency_id, name, attribute_type, options, is_required, display_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [agencyId, name, attrType, options ? JSON.stringify(options) : null, isRequired, order]
      );
      return r.rows[0].id;
    }

    async function insertBedroomAttrValue(bedroomId, defId, valueText, valueNumber, valueBoolean) {
      await client.query(
        `INSERT INTO bedroom_attribute_values (bedroom_id, attribute_definition_id, agency_id, value_text, value_number, value_boolean) VALUES ($1,$2,$3,$4,$5,$6)`,
        [bedroomId, defId, agencyId, valueText, valueNumber, valueBoolean]
      );
    }

    const bedroomAttrYouTube = await insertBedroomAttrDef('YouTube Video URL', 'text', null, false, 0);
    const bedroomAttrFurnished = await insertBedroomAttrDef('Furnished', 'boolean', null, false, 1);
    const bedroomAttrSize = await insertBedroomAttrDef('Room Size', 'dropdown', ['Small', 'Medium', 'Large', 'Extra Large'], false, 2);
    console.log('Created 3 bedroom attribute definitions');

    // ═══════════════════════════════════════════════════════════
    // 3. PROPERTIES & BEDROOMS
    // ═══════════════════════════════════════════════════════════

    const properties = []; // { id, type, bedroomIds[], bedroomPrices[] }
    const usedStreets = new Set();

    for (let i = 0; i < 50; i++) {
      // Pick a unique street
      let street;
      do { street = pick(STREETS); } while (usedStreets.has(street));
      usedStreets.add(street);

      const isHMO = i < 35; // 35 HMO, 15 whole house
      const numBeds = isHMO ? randInt(2, 5) : randInt(1, 3);
      const bathrooms = isHMO ? Math.ceil(numBeds / 2) : 1;
      const houseNum = randInt(1, 120);
      const isFlat = !isHMO && rand() > 0.5;
      const address1 = isFlat ? `Flat ${randInt(1, 8)}, ${houseNum} ${street}` : `${houseNum} ${street}`;
      const landlordId = landlordIds[i % landlordIds.length];

      const propId = await insertProperty({
        address1, city: 'Sheffield',
        postcode: `${pick(POSTCODES)}${randInt(1, 9)}${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}`,
        location: LOCATIONS[i % LOCATIONS.length],
        lettingType: isHMO ? 'Room Only' : 'Whole House',
        description: isHMO
          ? `${numBeds}-bed student house in ${LOCATIONS[i % LOCATIONS.length]}. Close to amenities.`
          : `${isFlat ? 'Modern' : 'Charming'} ${numBeds}-bed ${isFlat ? 'flat' : 'house'} in ${LOCATIONS[i % LOCATIONS.length]}.`,
        landlordId
      });

      // Populate custom attribute values
      const propertyType = isFlat ? 'Flat' : 'House';
      const hasParking = rand() > 0.5;
      const hasGarden = rand() > 0.4;
      const hasBills = !isHMO && rand() > 0.7;
      const broadbandSpeeds = ['50Mbps', '100Mbps', '200Mbps', '500Mbps', '1Gbps', null];
      const broadband = pick(broadbandSpeeds);

      await insertAttrValue(propId, attrPropertyType, propertyType, null, null);
      await insertAttrValue(propId, attrBathrooms, null, bathrooms, null);
      await insertAttrValue(propId, attrCommunalAreas, null, isHMO ? 1 : 0, null);
      await insertAttrValue(propId, attrHasParking, null, null, hasParking);
      await insertAttrValue(propId, attrHasGarden, null, null, hasGarden);
      await insertAttrValue(propId, attrBillsIncluded, null, null, hasBills);
      if (broadband) await insertAttrValue(propId, attrBroadband, broadband, null, null);

      const bedroomIds = [];
      const bedroomPrices = [];
      const roomTypes = ['Large Double', 'Double', 'Double', 'Double En-suite', 'Small Double', 'Single'];
      const roomSizes = ['Small', 'Medium', 'Large', 'Extra Large'];
      const youtubeUrls = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=abc123', 'https://www.youtube.com/watch?v=xyz789'];
      for (let b = 0; b < numBeds; b++) {
        const rType = isHMO ? roomTypes[b % roomTypes.length] : (numBeds === 1 ? 'Studio' : `Bedroom ${b + 1}`);
        const price = isHMO ? randInt(70, 120) : randInt(80, 150);
        const bedId = await insertBedroom(propId, isHMO ? `Room ${b + 1} - ${rType}` : rType, price, b + 1);
        bedroomIds.push(bedId);
        bedroomPrices.push(price);

        // ~30% of bedrooms get a YouTube URL attribute
        if (rand() < 0.3) {
          await insertBedroomAttrValue(bedId, bedroomAttrYouTube, pick(youtubeUrls), null, null);
        }
        // ~60% get furnished attribute
        if (rand() < 0.6) {
          await insertBedroomAttrValue(bedId, bedroomAttrFurnished, null, null, rand() > 0.3);
        }
        // ~50% get room size attribute
        if (rand() < 0.5) {
          await insertBedroomAttrValue(bedId, bedroomAttrSize, pick(roomSizes), null, null);
        }
      }

      properties.push({
        id: propId, isHMO, bedroomIds, bedroomPrices,
        type: isHMO ? 'room_only' : 'whole_house',
        numBeds
      });
    }
    console.log(`Created ${properties.length} properties with ${properties.reduce((s, p) => s + p.bedroomIds.length, 0)} bedrooms`);

    // ═══════════════════════════════════════════════════════════
    // 4. TENANCIES (procedural chain per property)
    // ═══════════════════════════════════════════════════════════

    let tenantIdx = 0; // Round-robin through tenant pool
    function nextTenant() { const t = tenantPool[tenantIdx % tenantPool.length]; tenantIdx++; return t; }

    const todayStr = d(Y, M, today.getDate());
    const allTenancies = []; // { id, status, start, end, memberIds[], propertyIdx }
    let activeCount = 0, expiredCount = 0;

    for (let pi = 0; pi < properties.length; pi++) {
      const prop = properties[pi];
      // Start chain 5-8 years ago
      let cursorMonth = M - randInt(60, 96); // months relative to now
      let cursorYear = Y;

      while (true) {
        const durationMonths = randInt(6, 12);
        const startDate = d(cursorYear, cursorMonth, 1);
        const endDate = d(cursorYear, cursorMonth + durationMonths, 1);

        const endDateObj = new Date(endDate);
        const isPast = endDateObj < today;
        const startDateObj = new Date(startDate);
        const isFuture = startDateObj > today;
        const isCurrentlyActive = startDateObj <= today && endDateObj >= today;

        // Decide how many beds to fill
        const occupancy = prop.isHMO ? randInt(Math.max(1, prop.numBeds - 1), prop.numBeds) : prop.numBeds;
        const totalRentPPPW = prop.bedroomPrices.slice(0, occupancy).reduce((s, p) => s + p, 0);
        const monthlyRent = Math.round(totalRentPPPW * 52 / 12);

        let status, autoPayments = true;
        if (isPast) {
          status = 'expired';
          autoPayments = false;
        } else if (isCurrentlyActive) {
          status = 'active';
        } else {
          // Would start in the future — skip for most properties
          break;
        }

        // RRA 2025: all tenancies are periodic (rolling monthly).
        // Active tenancies mostly have no end date. ~20% have an end date
        // representing an agreed termination (notice served).
        // Expired tenancies keep their end date (they ended in the past).
        let tenancyEndDate = endDate;
        if (status === 'active') {
          if (rand() > 0.2) {
            // ~80% of active tenancies: no end date (rolling periodic)
            tenancyEndDate = null;
          } else {
            // ~20%: notice served, termination date agreed in near future
            tenancyEndDate = d(Y, M + randInt(1, 3), 1);
          }
        }

        const tenId = await insertTenancy({
          propertyId: prop.id, type: prop.type,
          start: startDate, end: tenancyEndDate,
          rent: monthlyRent, status, autoPayments
        });

        const memberIds = [];
        const memberTenants = [];
        for (let mi = 0; mi < occupancy; mi++) {
          const tenant = nextTenant();
          const bedroomId = prop.isHMO ? prop.bedroomIds[mi] : (prop.numBeds === 1 ? prop.bedroomIds[0] : null);
          const rentPPPW = prop.bedroomPrices[mi] || prop.bedroomPrices[0];
          const deposit = rentPPPW * 4;
          const isSigned = status !== 'pending';
          const isStudent = rand() > 0.4;

          const memId = await insertMember({
            tenancyId: tenId, bedroomId, userId: tenant.id,
            firstName: tenant.firstName, surname: tenant.lastName, title: tenant.title,
            address: tenant.address, appType: isStudent ? 'student' : 'professional',
            rent: rentPPPW, deposit, paymentOption: pick(['monthly', 'monthly', 'monthly', 'quarterly']),
            signed: isSigned, signedAt: isSigned ? d(cursorYear, cursorMonth, -randInt(3, 10)) : null,
            keyStatus: isPast ? 'returned' : (isSigned ? 'collected' : 'not_collected'),
            keyCollected: isSigned ? startDate : null,
            keyReturned: isPast ? endDate : null
          });
          memberIds.push(memId);
          memberTenants.push({ ...tenant, memId, rentPPPW, deposit });
        }

        const tenancyInfo = { id: tenId, status, start: startDate, end: tenancyEndDate, memberIds, memberTenants, propertyIdx: pi, monthlyRent };

        // --- Payment schedules ---
        // For expired tenancies, use endDate (always set in loop) to determine recency
        const monthsAgo = monthsBetween(endDate, todayStr);

        if (status === 'active') {
          // Active: deposit (paid) + full monthly rent history + 1 future month
          const monthsSinceStart = monthsBetween(startDate, todayStr);
          // Cap rent periods at tenancyEndDate if notice has been served
          const maxRentMonths = tenancyEndDate
            ? Math.min(monthsSinceStart + 1, monthsBetween(startDate, tenancyEndDate))
            : monthsSinceStart + 1;
          for (const mt of memberTenants) {
            const monthlyAmt = Math.round(mt.rentPPPW * 52 / 12);
            // Deposit
            const depSid = await insertSchedule({ tenancyId: tenId, memberId: mt.memId, type: 'deposit', desc: `Deposit - ${mt.firstName} ${mt.lastName}`, due: startDate, amount: mt.deposit, status: 'paid', schedType: 'manual' });
            await insertPayment(depSid, mt.deposit, startDate, `DEP-${mt.lastName.substring(0, 4).toUpperCase()}`);
            // Monthly rent
            for (let mo = 0; mo <= maxRentMonths; mo++) {
              const dueDay = pick([1, 1, 1, 5, 10, 15, 20]);
              const dueDate = d(cursorYear, cursorMonth + mo, dueDay);
              const coversFrom = d(cursorYear, cursorMonth + mo, 1);
              const coversTo = d(cursorYear, cursorMonth + mo + 1, 1);
              let pStatus;
              if (mo < monthsSinceStart) {
                pStatus = 'paid';
              } else if (mo === monthsSinceStart) {
                // Current month — varied statuses
                const r = rand();
                pStatus = r < 0.6 ? 'paid' : r < 0.75 ? 'partial' : r < 0.85 ? 'overdue' : 'pending';
              } else {
                pStatus = 'pending';
              }
              const sid = await insertSchedule({ tenancyId: tenId, memberId: mt.memId, type: 'rent', desc: `Rent - ${mt.firstName} ${mt.lastName}`, due: dueDate, amount: monthlyAmt, status: pStatus, from: coversFrom, to: coversTo });
              if (pStatus === 'paid') await insertPayment(sid, monthlyAmt, dueDate, `RENT-${mt.lastName.substring(0, 3).toUpperCase()}-${mo}`);
              else if (pStatus === 'partial') await insertPayment(sid, Math.round(monthlyAmt * 0.5), dueDate, `RENT-PART-${mt.lastName.substring(0, 3).toUpperCase()}`);
            }
          }
        } else if (monthsAgo < 6) {
          // Recently expired: deposit paid + deposit return
          for (const mt of memberTenants) {
            const depSid = await insertSchedule({ tenancyId: tenId, memberId: mt.memId, type: 'deposit', desc: `Deposit - ${mt.firstName} ${mt.lastName}`, due: startDate, amount: mt.deposit, status: 'paid', schedType: 'manual' });
            await insertPayment(depSid, mt.deposit, startDate, `DEP-${mt.lastName.substring(0, 4).toUpperCase()}`);
            const retSid = await insertSchedule({ tenancyId: tenId, memberId: mt.memId, type: 'deposit_return', desc: `Deposit Return - ${mt.firstName} ${mt.lastName}`, due: endDate, amount: -mt.deposit, status: 'paid', schedType: 'manual' });
            await insertPayment(retSid, -mt.deposit, endDate, `DEPRET-${mt.lastName.substring(0, 4).toUpperCase()}`);
          }
        }
        // Older expired: no payment data (just tenancy + member records)

        allTenancies.push(tenancyInfo);
        if (status === 'active') activeCount++;
        else expiredCount++;

        // Move cursor past this tenancy + gap
        cursorMonth += durationMonths + randInt(1, 3);

        // Stop if we've gone past today for expired, or just created an active one
        if (status === 'active') break;
        const nextStart = new Date(d(cursorYear, cursorMonth, 1));
        if (nextStart > today) break;
      }
    }

    // Add a few extra statuses: pending + awaiting_signatures
    const pendingProp = properties[properties.length - 1];
    const awaitProp = properties[properties.length - 2];

    const penTen = await insertTenancy({
      propertyId: pendingProp.id, type: pendingProp.type,
      start: d(Y, M + 2, 1), end: null,
      rent: 500, status: 'pending'
    });
    const penTenant = nextTenant();
    const penMem = await insertMember({
      tenancyId: penTen, bedroomId: pendingProp.bedroomIds[0], userId: penTenant.id,
      firstName: penTenant.firstName, surname: penTenant.lastName, title: penTenant.title,
      address: penTenant.address, appType: 'student', rent: pendingProp.bedroomPrices[0], deposit: pendingProp.bedroomPrices[0] * 4
    });
    await insertSchedule({ tenancyId: penTen, memberId: penMem, type: 'deposit', desc: `Deposit - ${penTenant.firstName} ${penTenant.lastName}`, due: d(Y, M + 2, 1), amount: pendingProp.bedroomPrices[0] * 4, status: 'pending', schedType: 'manual' });
    allTenancies.push({ id: penTen, status: 'pending', memberIds: [penMem], memberTenants: [{ ...penTenant, memId: penMem }] });

    const awTen = await insertTenancy({
      propertyId: awaitProp.id, type: awaitProp.type,
      start: d(Y, M + 1, 1), end: null,
      rent: 450, status: 'awaiting_signatures'
    });
    for (let ai = 0; ai < Math.min(2, awaitProp.bedroomIds.length); ai++) {
      const awt = nextTenant();
      await insertMember({
        tenancyId: awTen, bedroomId: awaitProp.bedroomIds[ai], userId: awt.id,
        firstName: awt.firstName, surname: awt.lastName, title: awt.title,
        address: awt.address, appType: 'professional', rent: awaitProp.bedroomPrices[ai], deposit: awaitProp.bedroomPrices[ai] * 4
      });
    }
    allTenancies.push({ id: awTen, status: 'awaiting_signatures' });

    console.log(`Created ${activeCount} active + ${expiredCount} expired + 1 pending + 1 awaiting_signatures = ${allTenancies.length} total tenancies`);

    // ═══════════════════════════════════════════════════════════
    // 5. APPLICATIONS
    // ═══════════════════════════════════════════════════════════

    const appStatuses = ['converted_to_tenancy','converted_to_tenancy','converted_to_tenancy','converted_to_tenancy','converted_to_tenancy',
      'submitted','submitted','pending','pending','awaiting_guarantor','awaiting_guarantor','approved','approved','rejected','rejected'];
    let appCount = 0;

    for (let ai = 0; ai < 60; ai++) {
      const tenant = tenantPool[ai % tenantPool.length];
      const status = appStatuses[ai % appStatuses.length];
      const isStudent = rand() > 0.4;
      const hasGuarantor = isStudent && rand() > 0.3;
      const isComplete = ['converted_to_tenancy', 'submitted', 'approved', 'rejected'].includes(status);
      const createdMonthsAgo = randInt(0, 24);
      const createdDate = d(Y, M - createdMonthsAgo, randInt(1, 28));
      const completedDate = isComplete ? d(Y, M - createdMonthsAgo, randInt(5, 28)) : null;
      const gToken = status === 'awaiting_guarantor' ? crypto.randomUUID() : null;

      const formData = isStudent ? {
        residential_status: pick(['Living with Parents', 'Private Tenant', 'Council/Housing Association']),
        period_years: randInt(0, 3), period_months: randInt(0, 11),
        university: pick(UNIVERSITIES), year_of_study: `${pick(['1st', '2nd', '3rd', '4th'])} Year`,
        course: pick(COURSES), student_number: `SHF-${Y - randInt(0, 3)}-${randInt(10000, 99999)}`,
        payment_plan: pick(['monthly', 'termly']),
        ...(hasGuarantor ? {
          guarantor_name: `${pick(MALE_NAMES)} ${tenant.lastName}`,
          guarantor_email: `guarantor${ai}@email.com`,
          guarantor_phone: `07700 3${String(ai).padStart(5, '0')}`,
          guarantor_address: `${randInt(1, 100)} ${pick(STREETS)}, Sheffield`,
          guarantor_relationship: pick(['Father', 'Mother', 'Guardian'])
        } : {})
      } : {
        residential_status: pick(['Private Tenant', 'Homeowner', 'Living with Parents']),
        period_years: randInt(0, 5), period_months: randInt(0, 11),
        employment_type: pick(['Full-time', 'Part-time', 'Self-employed']),
        company_name: pick(['Sheffield Digital Ltd', 'NHS Sheffield', 'Boeing Sheffield', 'Rolls-Royce', 'University of Sheffield', 'Sheffield City Council', 'HSBC', 'Aviva']),
        employment_start_date: d(Y - randInt(1, 5), randInt(0, 11), 1),
        contact_name: `${pick(MALE_NAMES)} ${pick(LAST_NAMES)}`,
        contact_job_title: pick(['HR Manager', 'Line Manager', 'Director', 'Team Lead']),
        contact_email: `contact${ai}@company.com`, contact_phone: `0114 ${randInt(200, 999)}${randInt(1000, 9999)}`
      };

      await client.query(`
        INSERT INTO applications (agency_id, user_id, application_type, guarantor_required, status, first_name, surname, title, date_of_birth, email, phone, current_address, id_type, payment_method, declaration_name, declaration_agreed, declaration_date, completed_at, guarantor_token, guarantor_token_expires_at, form_data, form_version, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,1,$22)
      `, [
        agencyId, tenant.id, isStudent ? 'student' : 'professional', hasGuarantor, status,
        tenant.firstName, tenant.lastName, tenant.title,
        d(randInt(1990, 2004), randInt(0, 11), randInt(1, 28)),
        tenant.email, `07700 2${String(ai).padStart(5, '0')}`,
        tenant.address, pick(['passport', 'driving_licence']), 'bank_transfer',
        isComplete ? `${tenant.firstName} ${tenant.lastName}` : null,
        isComplete, isComplete ? completedDate : null, completedDate,
        gToken, gToken ? d(Y, M, today.getDate() + 7) : null,
        JSON.stringify(formData), createdDate
      ]);
      appCount++;
    }
    console.log(`Created ${appCount} applications`);

    // ═══════════════════════════════════════════════════════════
    // 6. MAINTENANCE REQUESTS
    // ═══════════════════════════════════════════════════════════

    const activeTenancies = allTenancies.filter(t => t.status === 'active' && t.memberTenants);
    const categories = ['plumbing','electrical','heating','appliances','structural','pest_control','general','other'];
    const priorities = ['low','medium','medium','high'];
    const maintStatuses = ['submitted','submitted','in_progress','completed'];
    const maintTitles = {
      plumbing: ['Tap leaking','Toilet not flushing','Blocked drain','Low water pressure','Pipe burst under sink'],
      electrical: ['Light not working','Socket sparking','Fuse keeps tripping','Doorbell broken','Extractor fan noisy'],
      heating: ['Radiator cold','Boiler not firing','No hot water','Thermostat broken','Heating timer faulty'],
      appliances: ['Washing machine broken','Oven not heating','Fridge not cooling','Dishwasher leaking','Tumble dryer noisy'],
      structural: ['Window cracked','Door not closing','Fence panel down','Damp patch on wall','Roof tile missing'],
      pest_control: ['Mice in kitchen','Wasps nest in loft','Ants in bathroom','Pigeons on roof','Slugs in hallway'],
      general: ['Doorbell not working','Letterbox broken','Gate latch stuck','Shed door jammed','Smoke alarm beeping'],
      other: ['Key not working','Garden overgrown','Parking issue','Bins not collected','Noise from neighbours']
    };
    let maintCount = 0;

    for (let mi = 0; mi < 20 && mi < activeTenancies.length; mi++) {
      const ten = activeTenancies[mi % activeTenancies.length];
      const mt = ten.memberTenants[randInt(0, ten.memberTenants.length - 1)];
      const cat = pick(categories);
      const priority = pick(priorities);
      const status = pick(maintStatuses);
      const title = pick(maintTitles[cat]);

      const reqId = await insertMaintRequest({
        tenancyId: ten.id, userId: mt.id,
        title, description: `${title}. This has been an issue for ${pick(['a few days','a week','about two weeks','a couple of days'])}. Please arrange for someone to look at it.`,
        category: cat, priority, status
      });

      // Tenant comment
      await insertComment(reqId, mt.id, 'comment', pick([
        'Please can someone look at this soon?',
        'This is getting worse, would appreciate a quick response.',
        'Happy to be home any day this week for access.',
        'We\'ve tried to fix it ourselves but no luck.'
      ]));

      if (status === 'in_progress' || status === 'completed') {
        await insertComment(reqId, adminId, 'status_change', null, 'submitted', 'in_progress');
        await insertComment(reqId, adminId, 'comment', pick([
          'Contractor booked for this week.',
          'We\'ll send someone out tomorrow morning.',
          'Maintenance team will attend within 48 hours.',
          'Parts ordered, engineer will visit once they arrive.'
        ]));
      }
      if (status === 'completed') {
        await insertComment(reqId, adminId, 'comment', 'Issue has been resolved. Please let us know if there are any further problems.');
        await insertComment(reqId, adminId, 'status_change', null, 'in_progress', 'completed');
      }
      maintCount++;
    }
    console.log(`Created ${maintCount} maintenance requests with comments`);

    // ─── COMMIT ────────────────────────────────────────────────
    await client.query('COMMIT');

    console.log('\n=== Seed Complete ===');
    console.log(`\nData Summary:`);
    console.log(`  1 admin (admin@test.com / password123)`);
    console.log(`  10 landlords (landlord1-10@test.com / password123)`);
    console.log(`  200 tenants (tenant1-200@test.com / password123)`);
    console.log(`  ${properties.length} properties`);
    console.log(`  ${appCount} applications`);
    console.log(`  ${activeCount} active + ${expiredCount} expired + 1 pending + 1 awaiting_signatures = ${allTenancies.length} tenancies`);
    console.log(`  ${maintCount} maintenance requests`);
    console.log(`\nLogin: http://localhost:3000/${agencySlug}/admin (admin@test.com / password123)\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestData().catch(err => {
  console.error('Failed to seed:', err);
  process.exit(1);
});
