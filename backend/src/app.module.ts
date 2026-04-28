import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ice-pos-local-secret',
      signOptions: { expiresIn: '30d' }
    })
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
