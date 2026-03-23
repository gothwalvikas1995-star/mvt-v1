import 'reflect-metadata';
import { NestFactory }       from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder }  from '@nestjs/swagger';
import { ExpressAdapter }    from '@nestjs/platform-express';
import * as express          from 'express';
import * as helmet           from 'helmet';
import * as compression      from 'compression';
import { AppModule }         from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

const server = express();
let cachedApp: any = null;

async function bootstrap() {
  if (cachedApp) return cachedApp;

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: process.env.NODE_ENV === 'development'
      ? ['error', 'warn', 'log', 'debug']
      : ['error', 'warn'],
  });

  app.use((helmet as any)());
  app.use(compression());

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger — enabled when ENABLE_SWAGGER=true
  if (process.env.ENABLE_SWAGGER === 'true') {
    const cfg = new DocumentBuilder()
      .setTitle('Bharat Health Connect API')
      .setDescription('MVT Connect Platform — Quality Council of India')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .addTag('Auth')
      .addTag('Profiles')
      .addTag('Discovery')
      .addTag('Connections')
      .addTag('Messaging')
      .addTag('Notifications')
      .addTag('Grievances')
      .addTag('Verification')
      .addTag('Admin')
      .build();
    SwaggerModule.setup('api/docs', app,
      SwaggerModule.createDocument(app, cfg),
      { swaggerOptions: { persistAuthorization: true } }
    );
  }

  await app.init();
  cachedApp = app;
  return app;
}

// Vercel serverless handler
export default async (req: any, res: any) => {
  await bootstrap();
  server(req, res);
};

// Local dev
if (process.env.NODE_ENV !== 'production') {
  bootstrap().then(() =>
    server.listen(process.env.PORT || 3000, () =>
      console.log(`🚀 BHC API → http://localhost:${process.env.PORT || 3000}/api\n📚 Docs → http://localhost:${process.env.PORT || 3000}/api/docs`)
    )
  );
}
