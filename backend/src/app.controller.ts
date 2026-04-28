import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly jwtService: JwtService
  ) {}

  @Post('auth/login-pin')
  loginPin(@Body() body: { user_id: string; pin: string }) {
    const user = this.appService.loginByPin(body.user_id, body.pin);
    if (!user) return { ok: false };
    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { ok: true, token, user };
  }

  @Get('auth/me')
  me(@Query('user_id') userId: string) {
    return this.appService.me(userId);
  }

  @Post('auth/logout')
  logout() {
    return { ok: true };
  }

  @Get('users')
  users() {
    return this.appService.getUsers();
  }

  @Post('users')
  createUser(@Body() body: Record<string, unknown>) {
    return this.appService.createUser(body);
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appService.updateUser(id, body);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.appService.deleteUser(id);
  }

  @Get('products')
  products() {
    return this.appService.getProducts();
  }

  @Post('products')
  createProduct(@Body() body: Record<string, unknown>) {
    return this.appService.createProduct(body);
  }

  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appService.updateProduct(id, body);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.appService.deleteProduct(id);
  }

  @Get('sales')
  sales() {
    return this.appService.getSales();
  }

  @Post('sales')
  createSale(@Body() body: { sale: Record<string, unknown>; items: Array<Record<string, unknown>> }) {
    return this.appService.createSale(body);
  }

  @Get('sales/:id')
  getSale(@Param('id') id: string) {
    return this.appService.getSaleById(id);
  }

  @Post('shifts/open')
  openShift(@Body() body: Record<string, unknown>) {
    return this.appService.openShift(body);
  }

  @Post('shifts/close')
  closeShift(@Body() body: Record<string, unknown>) {
    return this.appService.closeShift(body);
  }

  @Get('shifts/current')
  currentShift(@Query('user_id') userId?: string) {
    return this.appService.getCurrentShift(userId);
  }

  @Get('shifts')
  shifts() {
    return this.appService.getShifts();
  }

  @Get('expenses')
  expenses() {
    return this.appService.getExpenses();
  }

  @Post('expenses')
  createExpense(@Body() body: Record<string, unknown>) {
    return this.appService.createExpense(body);
  }

  @Put('expenses/:id')
  updateExpense(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appService.updateExpense(id, body);
  }

  @Delete('expenses/:id')
  deleteExpense(@Param('id') id: string) {
    return this.appService.deleteExpense(id);
  }

  @Get('expense-categories')
  expenseCategories() {
    return this.appService.getExpenseCategories();
  }

  @Post('expense-categories')
  createExpenseCategory(@Body() body: Record<string, unknown>) {
    return this.appService.createExpenseCategory(body);
  }

  @Get('recurring-expenses')
  recurringExpenses() {
    return this.appService.getRecurringExpenses();
  }

  @Post('recurring-expenses')
  createRecurringExpenses(@Body() body: Record<string, unknown>) {
    return this.appService.createRecurringExpense(body);
  }

  @Get('stock')
  stock() {
    return this.appService.getStock();
  }

  @Post('stock/income')
  stockIncome(@Body() body: { stock_item_id: string; quantity: number; amount: number }) {
    return this.appService.stockIncome(body);
  }

  @Post('stock/write-off')
  stockWriteOff(@Body() body: { stock_item_id: string; quantity: number }) {
    return this.appService.stockWriteOff(body);
  }

  @Post('stock/inventory')
  stockInventory(@Body() body: { stock_item_id: string; quantity: number }) {
    return this.appService.stockInventory(body);
  }

  @Get('stock/movements')
  stockMovements() {
    return this.appService.stockMovements();
  }

  @Get('salary')
  salary(@Query('user_id') userId?: string, @Query('period_start') periodStart?: string, @Query('period_end') periodEnd?: string) {
    return this.appService.getSalary(userId, periodStart, periodEnd);
  }

  @Get('salary/user/:id')
  salaryByUser(@Param('id') id: string, @Query('period_start') periodStart?: string, @Query('period_end') periodEnd?: string) {
    return this.appService.getSalary(id, periodStart, periodEnd);
  }

  @Post('salary/bonus')
  salaryBonus(@Body() body: Record<string, unknown>) {
    return this.appService.addSalaryTx({ ...body, type: 'bonus' });
  }

  @Post('salary/penalty')
  salaryPenalty(@Body() body: Record<string, unknown>) {
    return this.appService.addSalaryTx({ ...body, type: 'penalty' });
  }

  @Post('salary/payout')
  salaryPayout(@Body() body: Record<string, unknown>) {
    return this.appService.addSalaryTx({ ...body, type: 'payout' });
  }

  @Get('payroll')
  payroll() {
    return this.appService.getPayroll();
  }

  @Post('payroll/generate')
  payrollGenerate(@Body() body: Record<string, unknown>) {
    return this.appService.generatePayroll(body);
  }

  @Post('payroll/:id/pay')
  payrollPay(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appService.payrollPay(id, body);
  }

  @Get('reports/daily')
  reportDaily(@Query('date') date?: string) {
    return this.appService.getDailyReport(date ?? new Date().toISOString().slice(0, 10));
  }

  @Get('reports/period')
  reportPeriod(@Query('period_start') periodStart?: string, @Query('period_end') periodEnd?: string) {
    const today = new Date().toISOString().slice(0, 10);
    return this.appService.getPeriodReport(periodStart ?? today, periodEnd ?? today);
  }

  @Get('reports/products')
  reportProducts(@Query('period_start') periodStart?: string, @Query('period_end') periodEnd?: string) {
    if (!periodStart || !periodEnd) return this.appService.getProductsReport();
    return this.appService.getProductsReport();
  }

  @Get('reports/payments')
  reportPayments(@Query('period_start') periodStart?: string, @Query('period_end') periodEnd?: string) {
    return this.appService.getPaymentsReport(periodStart, periodEnd);
  }

  @Get('reports/expenses')
  reportExpenses() {
    return this.appService.getExpensesReport();
  }

  @Get('reports/stock')
  reportStock() {
    return this.appService.getStockReport();
  }

  @Get('reports/losses')
  reportLosses() {
    return this.appService.getLossesReport();
  }

  @Get('reports/salary')
  reportSalary() {
    return this.appService.getSalaryReport();
  }

  @Get('reports/cashiers')
  reportCashiers(@Query('period_start') periodStart?: string, @Query('period_end') periodEnd?: string) {
    return this.appService.getCashiersReport(periodStart, periodEnd);
  }

  @Get('reports/profit')
  reportProfit() {
    return this.appService.getProfitReport();
  }

  @Get('accounts')
  accountsList() {
    return this.appService.getAccounts();
  }

  @Post('accounts')
  createAccount(@Body() body: Record<string, unknown>) {
    return this.appService.createAccount(body);
  }

  @Put('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appService.updateAccount(id, body);
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string) {
    return this.appService.deleteAccount(id);
  }

  @Get('account-transactions')
  accountTransactionsList() {
    return this.appService.getAccountTransactions();
  }

  @Post('account-transactions')
  appendAccountTransactions(@Body() body: { rows?: Array<Record<string, unknown>> }) {
    const rows = body.rows ?? [];
    this.appService.appendAccountTransactions(rows as never[]);
    return { ok: true, count: rows.length };
  }

  @Post('accounts/transfer')
  accountsTransfer(@Body() body: Record<string, unknown>) {
    return { ok: true, body };
  }

  @Post('accounts/correction')
  accountsCorrection(@Body() body: Record<string, unknown>) {
    return { ok: true, body };
  }

  @Get('accounts/:id/history')
  accountHistory(@Param('id') id: string, @Query() query: Record<string, string>) {
    return this.appService.accountHistory(id, query);
  }

  @Get('accounts/summary')
  accountsSummary() {
    return this.appService.accountsSummary();
  }

  @Post('sync/push')
  syncPush(@Body() body: Record<string, unknown>) {
    return this.appService.syncPush(body);
  }

  @Get('sync/pull')
  syncPull() {
    return this.appService.syncPull();
  }

  @Post('sync/full')
  syncFull(@Body() body: Record<string, unknown>) {
    return this.appService.syncFull(body);
  }
}
