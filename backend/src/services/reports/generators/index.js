/**
 * Report Generators Index
 *
 * Exports all report generators for use by the main report service.
 */

const portfolioGenerator = require('./portfolioGenerator');
const occupancyGenerator = require('./occupancyGenerator');
const financialGenerator = require('./financialGenerator');
const arrearsGenerator = require('./arrearsGenerator');
const upcomingEndingsGenerator = require('./upcomingEndingsGenerator');

module.exports = {
  portfolio: portfolioGenerator,
  occupancy: occupancyGenerator,
  financial: financialGenerator,
  arrears: arrearsGenerator,
  upcoming_endings: upcomingEndingsGenerator,
};
