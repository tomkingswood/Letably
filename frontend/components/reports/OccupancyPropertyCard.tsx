'use client';

import { PropertyOccupancy } from './types';
import { formatCurrency, formatDate, formatTenancyPeriod } from './utils';

interface OccupancyPropertyCardProps {
  property: PropertyOccupancy;
  showLandlord?: boolean;
}

export default function OccupancyPropertyCard({
  property,
  showLandlord = false,
}: OccupancyPropertyCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Property Header */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{property.address}</h3>
            <p className="text-sm text-gray-600">{property.city}, {property.postcode}</p>
            {showLandlord && property.landlord_name && (
              <p className="text-xs text-purple-600 mt-1">Landlord: {property.landlord_name}</p>
            )}
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              property.occupancy.rate === 100 ? 'bg-green-100 text-green-800' :
              property.occupancy.rate >= 50 ? 'bg-amber-100 text-amber-800' :
              'bg-red-100 text-red-800'
            }`}>
              {property.occupancy.occupied}/{property.occupancy.total} Rooms ({property.occupancy.rate}%)
            </span>
          </div>
        </div>
      </div>

      {/* Content - Whole House or Room Table */}
      {property.wholeHouseTenancy ? (
        <WholeHouseTenancyDisplay
          current={property.wholeHouseTenancy}
          next={property.nextWholeHouseTenancy}
        />
      ) : (
        <BedroomTable bedrooms={property.bedrooms} />
      )}
    </div>
  );
}

interface WholeHouseTenancyDisplayProps {
  current: PropertyOccupancy['wholeHouseTenancy'];
  next: PropertyOccupancy['nextWholeHouseTenancy'];
}

function WholeHouseTenancyDisplay({ current, next }: WholeHouseTenancyDisplayProps) {
  return (
    <div className="p-4 space-y-3">
      {current && (
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">Whole House Tenancy</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Tenants:</span>
              <p className="font-medium">{current.tenants}</p>
            </div>
            <div>
              <span className="text-gray-600">Total Rent:</span>
              <p className="font-medium">{formatCurrency(current.totalRent)}/pw</p>
            </div>
            <div>
              <span className="text-gray-600">Start:</span>
              <p className="font-medium">{formatDate(current.startDate)}</p>
            </div>
            <div>
              <span className="text-gray-600">End:</span>
              <p className="font-medium">{formatDate(current.endDate) || '(Rolling)'}</p>
            </div>
          </div>
        </div>
      )}
      {next && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm font-medium text-green-800 mb-2">Next Tenancy</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Tenants:</span>
              <p className="font-medium">{next.tenants}</p>
            </div>
            <div>
              <span className="text-gray-600">Total Rent:</span>
              <p className="font-medium">{formatCurrency(next.totalRent)}/pw</p>
            </div>
            <div>
              <span className="text-gray-600">Start:</span>
              <p className="font-medium">{formatDate(next.startDate)}</p>
            </div>
            <div>
              <span className="text-gray-600">End:</span>
              <p className="font-medium">{formatDate(next.endDate) || '(Rolling)'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BedroomTableProps {
  bedrooms: PropertyOccupancy['bedrooms'];
}

function BedroomTable({ bedrooms }: BedroomTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Bedroom</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-right">Rent</th>
            <th className="px-4 py-3 text-left">Current Tenancy</th>
            <th className="px-4 py-3 text-left">Next Tenancy</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {bedrooms.map((room) => (
            <tr key={room.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{room.name}</td>
              <td className="px-4 py-3 text-center">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  room.isOccupied
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {room.isOccupied ? 'Occupied' : 'Vacant'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {room.tenant
                  ? formatCurrency(room.tenant.rentPPPW) + '/pw'
                  : formatCurrency(room.baseRent) + '/pw'}
              </td>
              <td className="px-4 py-3 text-sm">
                {room.tenant ? (
                  <div>
                    <p className="text-gray-900 font-medium">{room.tenant.name}</p>
                    <p className="text-gray-500 text-xs">
                      {formatTenancyPeriod(room.tenant.tenancyStart, room.tenant.tenancyEnd)}
                    </p>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                {room.nextTenant ? (
                  <div>
                    <p className="text-gray-900 font-medium">{room.nextTenant.name}</p>
                    <p className="text-gray-500 text-xs">
                      {formatTenancyPeriod(room.nextTenant.tenancyStart, room.nextTenant.tenancyEnd)}
                    </p>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
