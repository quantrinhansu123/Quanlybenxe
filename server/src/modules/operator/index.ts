/**
 * Operator Module
 * Public exports for the Operator module
 */

export { operatorRepository, OperatorRepository } from './repositories/operator.repository.js'
export { operatorService, OperatorService } from './services/operator.service.js'
export type { CreateOperatorDTO, UpdateOperatorDTO } from './services/operator.service.js'
export { default as operatorRoutes } from './operator.routes.js'
