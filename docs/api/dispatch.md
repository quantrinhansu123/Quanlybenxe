# Dispatch API

## Overview

The Dispatch API handles the complete lifecycle of vehicle dispatch operations at the bus station, from vehicle entry to exit.

## Base URL

```
/api/dispatch
```

## Authentication

All endpoints require authentication via JWT Bearer token.

```
Authorization: Bearer <token>
```

## Status Flow

```
entered → passengers_dropped → permit_issued → paid → departure_ordered → departed → exited
                            ↘ permit_rejected
```

---

## Endpoints

### GET /api/dispatch

Get all dispatch records with optional filters.

**Query Parameters:**

| Parameter   | Type   | Description                       |
|-------------|--------|-----------------------------------|
| status      | string | Filter by current status          |
| shiftId     | string | Filter by shift                   |
| startDate   | string | Filter by date range start (ISO)  |
| endDate     | string | Filter by date range end (ISO)    |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "vehicleId": "string",
      "driverId": "string",
      "routeId": "string | null",
      "currentStatus": "entered",
      "entryTime": "2024-12-18T08:00:00+07:00",
      "vehiclePlateNumber": "51A-12345",
      "vehicleSeatCapacity": 45,
      "vehicleBedCapacity": 0,
      "vehicleTypeName": "Ghe ngoi",
      "driverFullName": "Nguyen Van A",
      "routeName": "Sai Gon - Vung Tau",
      "operatorId": "string",
      "operatorName": "Nha Xe ABC",
      "operatorCode": "ABC",
      "passengersArrived": 0,
      "passengersDeparting": 0,
      "permitStatus": null,
      "transportOrderCode": null,
      "paymentAmount": 0,
      "paymentMethod": null,
      "createdAt": "2024-12-18T08:00:00Z",
      "updatedAt": "2024-12-18T08:00:00Z"
    }
  ]
}
```

---

### GET /api/dispatch/:id

Get a single dispatch record by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "string",
    "vehicleId": "string",
    // ... full dispatch record
  }
}
```

---

### POST /api/dispatch/entry

Record vehicle entry to the station.

**Request Body:**

| Field        | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| vehicleId    | string | Yes      | Vehicle ID                 |
| driverId     | string | Yes      | Driver ID                  |
| routeId      | string | No       | Route ID                   |
| entryTime    | string | No       | Entry time (ISO, defaults to now) |
| entryShiftId | string | No       | Entry shift ID             |
| notes        | string | No       | Additional notes           |

**Example Request:**

```json
{
  "vehicleId": "vehicle-123",
  "driverId": "driver-456",
  "routeId": "route-789",
  "notes": "Arrived early"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Vehicle entry recorded",
  "data": {
    "id": "dispatch-new-id",
    "currentStatus": "entered",
    // ... full dispatch record
  }
}
```

---

### POST /api/dispatch/:id/passenger-drop

Record passenger drop-off.

**Request Body:**

| Field             | Type    | Required | Description              |
|-------------------|---------|----------|--------------------------|
| passengersArrived | integer | No       | Number of passengers arrived |
| routeId           | string  | No       | Route ID (if not set)    |

**Example Request:**

```json
{
  "passengersArrived": 30,
  "routeId": "route-789"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Passenger drop recorded",
  "data": {
    "id": "dispatch-id",
    "currentStatus": "passengers_dropped",
    "passengersArrived": 30,
    // ... full dispatch record
  }
}
```

---

### POST /api/dispatch/:id/permit

Issue or reject boarding permit.

**Request Body:**

| Field               | Type    | Required | Description                        |
|---------------------|---------|----------|------------------------------------|
| permitStatus        | string  | Yes      | "approved" or "rejected"           |
| transportOrderCode  | string  | If approved | Transport order code           |
| seatCount           | integer | No       | Number of seats authorized         |
| plannedDepartureTime| string  | No       | Planned departure time (ISO)       |
| rejectionReason     | string  | If rejected | Reason for rejection            |
| replacementVehicleId| string  | No       | Alternative vehicle ID             |

**Example Request (Approved):**

```json
{
  "permitStatus": "approved",
  "transportOrderCode": "TO-2024-001",
  "seatCount": 45,
  "plannedDepartureTime": "2024-12-18T10:00:00+07:00"
}
```

**Example Request (Rejected):**

```json
{
  "permitStatus": "rejected",
  "rejectionReason": "Invalid inspection certificate"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Permit issued",
  "data": {
    "id": "dispatch-id",
    "currentStatus": "permit_issued",
    "permitStatus": "approved",
    "transportOrderCode": "TO-2024-001",
    // ... full dispatch record
  }
}
```

---

### POST /api/dispatch/:id/payment

Record payment.

**Request Body:**

| Field          | Type    | Required | Description                    |
|----------------|---------|----------|--------------------------------|
| paymentAmount  | number  | No       | Payment amount (VND)           |
| paymentMethod  | string  | No       | "cash", "transfer", or "card"  |
| invoiceNumber  | string  | No       | Invoice number                 |

**Example Request:**

```json
{
  "paymentAmount": 150000,
  "paymentMethod": "cash",
  "invoiceNumber": "INV-2024-001"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment recorded",
  "data": {
    "id": "dispatch-id",
    "currentStatus": "paid",
    "paymentAmount": 150000,
    "paymentMethod": "cash",
    // ... full dispatch record
  }
}
```

---

### POST /api/dispatch/:id/departure-order

Issue departure order.

**Request Body:**

| Field                  | Type    | Required | Description                |
|------------------------|---------|----------|----------------------------|
| passengersDeparting    | integer | No       | Number of passengers       |
| departureOrderShiftId  | string  | No       | Departure order shift ID   |

**Example Request:**

```json
{
  "passengersDeparting": 42,
  "departureOrderShiftId": "shift-morning"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Departure order issued",
  "data": {
    "id": "dispatch-id",
    "currentStatus": "departure_ordered",
    "passengersDeparting": 42,
    // ... full dispatch record
  }
}
```

---

### POST /api/dispatch/:id/exit

Record vehicle exit from the station.

**Request Body:**

| Field              | Type    | Required | Description                    |
|--------------------|---------|----------|--------------------------------|
| exitTime           | string  | No       | Exit time (ISO, defaults to now) |
| passengersDeparting| integer | No       | Final passenger count          |
| exitShiftId        | string  | No       | Exit shift ID                  |

**Example Request:**

```json
{
  "exitTime": "2024-12-18T10:30:00+07:00",
  "passengersDeparting": 42,
  "exitShiftId": "shift-morning"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Vehicle exit recorded",
  "data": {
    "id": "dispatch-id",
    "currentStatus": "exited",
    "exitTime": "2024-12-18T10:30:00+07:00",
    // ... full dispatch record
  }
}
```

---

## Error Responses

### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "path": ["vehicleId"],
      "message": "Required"
    }
  ]
}
```

### Not Found (404)

```json
{
  "success": false,
  "message": "Dispatch record not found"
}
```

### Invalid Status Transition (400)

```json
{
  "success": false,
  "message": "Invalid status transition from 'entered' to 'paid'"
}
```

### Authentication Error (401)

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

## Status Descriptions

| Status            | Description                                      |
|-------------------|--------------------------------------------------|
| entered           | Vehicle has entered the station                  |
| passengers_dropped| Passengers have been dropped off                 |
| permit_issued     | Boarding permit has been approved                |
| permit_rejected   | Boarding permit has been rejected                |
| paid              | Station fees have been paid                      |
| departure_ordered | Departure order has been issued                  |
| departed          | Vehicle has departed with passengers             |
| exited            | Vehicle has exited the station                   |

---

## Rate Limiting

- 100 requests per minute per user
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
