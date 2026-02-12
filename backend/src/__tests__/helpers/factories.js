/**
 * Test Data Factories
 *
 * Creates test data objects with sensible defaults.
 * Use these to quickly generate test fixtures.
 */

const bcrypt = require('bcryptjs');
const { TEST_AGENCY_ID, testQuery } = require('./testDb');

let idCounters = {
  user: 100,
  landlord: 100,
  property: 100,
  room: 100,
  tenancy: 100,
  application: 100,
  payment: 100
};

/**
 * Reset ID counters (call in beforeEach)
 */
function resetCounters() {
  Object.keys(idCounters).forEach(key => {
    idCounters[key] = 100;
  });
}

/**
 * Generate unique ID for a type
 */
function nextId(type) {
  return idCounters[type]++;
}

/**
 * User factory
 */
const userFactory = {
  /**
   * Build a user object without persisting
   */
  build(overrides = {}) {
    const id = nextId('user');
    return {
      id,
      email: `user${id}@test.com`,
      password_hash: bcrypt.hashSync('Password123!', 10),
      first_name: 'Test',
      last_name: `User${id}`,
      role: 'admin',
      agency_id: TEST_AGENCY_ID,
      is_active: true,
      created_at: new Date(),
      ...overrides
    };
  },

  /**
   * Create a user in the database
   */
  async create(overrides = {}) {
    const user = this.build(overrides);
    const result = await testQuery(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, agency_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user.email, user.password_hash, user.first_name, user.last_name, user.role, user.agency_id, user.is_active]
    );
    return result.rows[0];
  }
};

/**
 * Landlord factory
 */
const landlordFactory = {
  build(overrides = {}) {
    const id = nextId('landlord');
    return {
      id,
      name: `Landlord ${id}`,
      email: `landlord${id}@test.com`,
      phone: `07${String(id).padStart(9, '0')}`,
      agency_id: TEST_AGENCY_ID,
      created_at: new Date(),
      ...overrides
    };
  },

  async create(overrides = {}) {
    const landlord = this.build(overrides);
    const result = await testQuery(
      `INSERT INTO landlords (name, email, phone, agency_id, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [landlord.name, landlord.email, landlord.phone, landlord.agency_id, landlord.user_id || null]
    );
    return result.rows[0];
  }
};

/**
 * Property factory
 */
const propertyFactory = {
  build(overrides = {}) {
    const id = nextId('property');
    return {
      id,
      address_line1: `${id} Test Street`,
      address_line2: null,
      city: 'London',
      postcode: `SW1A ${String(id).slice(-1)}AA`,
      property_type: 'hmo',
      agency_id: TEST_AGENCY_ID,
      created_at: new Date(),
      ...overrides
    };
  },

  async create(overrides = {}) {
    const property = this.build(overrides);
    // Ensure landlord exists
    if (!property.landlord_id) {
      const landlord = await landlordFactory.create();
      property.landlord_id = landlord.id;
    }
    const result = await testQuery(
      `INSERT INTO properties (title, address_line1, address_line2, city, postcode, property_type, landlord_id, agency_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [property.title || `${property.address_line1}, ${property.city}`, property.address_line1, property.address_line2, property.city, property.postcode,
       property.property_type, property.landlord_id, property.agency_id]
    );
    return result.rows[0];
  }
};

/**
 * Room factory
 */
const roomFactory = {
  build(overrides = {}) {
    const id = nextId('room');
    return {
      id,
      name: `Room ${id}`,
      base_rent: 150.00,
      agency_id: TEST_AGENCY_ID,
      created_at: new Date(),
      ...overrides
    };
  },

  async create(overrides = {}) {
    const room = this.build(overrides);
    // Ensure property exists
    if (!room.property_id) {
      const property = await propertyFactory.create();
      room.property_id = property.id;
    }
    const result = await testQuery(
      `INSERT INTO bedrooms (bedroom_name, price_pppw, property_id, agency_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [room.name, room.base_rent, room.property_id, room.agency_id]
    );
    return result.rows[0];
  }
};

/**
 * Application factory
 */
const applicationFactory = {
  build(overrides = {}) {
    const id = nextId('application');
    return {
      id,
      applicant_first_name: `Applicant`,
      applicant_last_name: `${id}`,
      applicant_email: `applicant${id}@test.com`,
      applicant_phone: `07${String(id).padStart(9, '0')}`,
      status: 'pending',
      agency_id: TEST_AGENCY_ID,
      created_at: new Date(),
      ...overrides
    };
  },

  async create(overrides = {}) {
    const app = this.build(overrides);
    // Ensure user exists (user_id is NOT NULL)
    if (!app.user_id) {
      const user = await userFactory.create({ role: 'tenant' });
      app.user_id = user.id;
    }
    const result = await testQuery(
      `INSERT INTO applications (agency_id, user_id, first_name, surname, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [app.agency_id, app.user_id, app.applicant_first_name, app.applicant_last_name, app.status]
    );
    return result.rows[0];
  }
};

/**
 * Tenancy factory
 */
const tenancyFactory = {
  build(overrides = {}) {
    const id = nextId('tenancy');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    return {
      id,
      start_date: startDate,
      end_date: endDate,
      rent_amount: 150.00,
      rent_frequency: 'weekly',
      status: 'active',
      agency_id: TEST_AGENCY_ID,
      created_at: new Date(),
      ...overrides
    };
  },

  async create(overrides = {}) {
    const tenancy = this.build(overrides);
    // Ensure bedroom exists and get property_id
    if (!tenancy.bedroom_id) {
      const room = await roomFactory.create();
      tenancy.bedroom_id = room.id;
      if (!tenancy.property_id) {
        tenancy.property_id = room.property_id;
      }
    }
    // Ensure property_id is set (NOT NULL)
    if (!tenancy.property_id) {
      const bedroomResult = await testQuery('SELECT property_id FROM bedrooms WHERE id = $1', [tenancy.bedroom_id]);
      tenancy.property_id = bedroomResult.rows[0]?.property_id;
    }
    const result = await testQuery(
      `INSERT INTO tenancies (property_id, bedroom_id, start_date, end_date, rent_amount, rent_frequency, status, agency_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenancy.property_id, tenancy.bedroom_id, tenancy.start_date, tenancy.end_date, tenancy.rent_amount,
       tenancy.rent_frequency, tenancy.status, tenancy.agency_id]
    );
    return result.rows[0];
  }
};

/**
 * Payment factory
 */
const paymentFactory = {
  build(overrides = {}) {
    const id = nextId('payment');
    return {
      id,
      amount: 150.00,
      due_date: new Date(),
      status: 'pending',
      agency_id: TEST_AGENCY_ID,
      created_at: new Date(),
      ...overrides
    };
  },

  async create(overrides = {}) {
    const payment = this.build(overrides);
    let tenancyId = payment.tenancy_id;
    // Ensure tenancy member exists
    if (!payment.tenancy_member_id) {
      // Create a full tenancy with member
      const tenancy = await tenancyFactory.create();
      tenancyId = tenancy.id;
      const user = await userFactory.create({ role: 'tenant' });
      const memberResult = await testQuery(
        `INSERT INTO tenancy_members (tenancy_id, user_id, rent_pppw, agency_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [tenancy.id, user.id, 150.00, TEST_AGENCY_ID]
      );
      payment.tenancy_member_id = memberResult.rows[0].id;
    }
    const result = await testQuery(
      `INSERT INTO payment_schedules (tenancy_member_id, tenancy_id, amount_due, due_date, payment_type, status, agency_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [payment.tenancy_member_id, tenancyId, payment.amount, payment.due_date, payment.payment_type || 'rent', payment.status, payment.agency_id]
    );
    return result.rows[0];
  }
};

module.exports = {
  resetCounters,
  nextId,
  userFactory,
  landlordFactory,
  propertyFactory,
  roomFactory,
  applicationFactory,
  tenancyFactory,
  paymentFactory
};
