async function validateComplianceCertificates(db, agencyId, propertyId) {
  const today = new Date().toISOString().split('T')[0];
  const issues = [];

  const propertyComplianceTypes = await db.query(`
    SELECT id, display_name, has_expiry
    FROM certificate_types
    WHERE agency_id = $1 AND type = 'property' AND is_compliance = true AND is_active = true
  `, [agencyId], agencyId);

  if (propertyComplianceTypes.rows.length > 0) {
    const propertyCerts = await db.query(`
      SELECT DISTINCT ON (certificate_type_id) certificate_type_id, expiry_date
      FROM certificates
      WHERE entity_type = 'property' AND entity_id = $1 AND agency_id = $2
      ORDER BY certificate_type_id, expiry_date DESC NULLS LAST, created_at DESC
    `, [propertyId, agencyId], agencyId);

    const propertyCertsByType = {};
    for (const cert of propertyCerts.rows) {
      propertyCertsByType[cert.certificate_type_id] = cert;
    }

    for (const type of propertyComplianceTypes.rows) {
      const cert = propertyCertsByType[type.id];
      if (!cert) {
        issues.push(`${type.display_name} (missing - property)`);
      } else if (type.has_expiry && cert.expiry_date && cert.expiry_date.toISOString().split('T')[0] < today) {
        issues.push(`${type.display_name} (expired - property)`);
      }
    }
  }

  const agencyComplianceTypes = await db.query(`
    SELECT id, display_name, has_expiry
    FROM certificate_types
    WHERE agency_id = $1 AND type = 'agency' AND is_compliance = true AND is_active = true
  `, [agencyId], agencyId);

  if (agencyComplianceTypes.rows.length > 0) {
    const agencyCerts = await db.query(`
      SELECT DISTINCT ON (certificate_type_id) certificate_type_id, expiry_date
      FROM certificates
      WHERE entity_type = 'agency' AND entity_id = $1 AND agency_id = $2
      ORDER BY certificate_type_id, expiry_date DESC NULLS LAST, created_at DESC
    `, [agencyId, agencyId], agencyId);

    const agencyCertsByType = {};
    for (const cert of agencyCerts.rows) {
      agencyCertsByType[cert.certificate_type_id] = cert;
    }

    for (const type of agencyComplianceTypes.rows) {
      const cert = agencyCertsByType[type.id];
      if (!cert) {
        issues.push(`${type.display_name} (missing - agency)`);
      } else if (type.has_expiry && cert.expiry_date && cert.expiry_date.toISOString().split('T')[0] < today) {
        issues.push(`${type.display_name} (expired - agency)`);
      }
    }
  }

  return issues;
}

async function validateTenancyComplianceCertificates(db, agencyId, tenancyId) {
  const today = new Date().toISOString().split('T')[0];
  const issues = [];

  const tenancyComplianceTypes = await db.query(`
    SELECT id, display_name, has_expiry
    FROM certificate_types
    WHERE agency_id = $1 AND type = 'tenancy' AND is_compliance = true AND is_active = true
  `, [agencyId], agencyId);

  if (tenancyComplianceTypes.rows.length > 0) {
    const tenancyCerts = await db.query(`
      SELECT DISTINCT ON (certificate_type_id) certificate_type_id, expiry_date
      FROM certificates
      WHERE entity_type = 'tenancy' AND entity_id = $1 AND agency_id = $2
      ORDER BY certificate_type_id, expiry_date DESC NULLS LAST, created_at DESC
    `, [tenancyId, agencyId], agencyId);

    const tenancyCertsByType = {};
    for (const cert of tenancyCerts.rows) {
      tenancyCertsByType[cert.certificate_type_id] = cert;
    }

    for (const type of tenancyComplianceTypes.rows) {
      const cert = tenancyCertsByType[type.id];
      if (!cert) {
        issues.push(`${type.display_name} (missing)`);
      } else if (type.has_expiry && cert.expiry_date && cert.expiry_date.toISOString().split('T')[0] < today) {
        issues.push(`${type.display_name} (expired)`);
      }
    }
  }

  return issues;
}

module.exports = { validateComplianceCertificates, validateTenancyComplianceCertificates };
