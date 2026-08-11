@echo off
REM Instala dependências do client
cd client
call npm install

REM Faz build do client
call npm run build

cd ..

REM Instala dependências do server
cd server
call npm install

REM Gera Prisma Client e aplica o schema
call npx prisma generate
call npx prisma db push