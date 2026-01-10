import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { updateCompanySchema } from "@/lib/validations/company";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json(
      { error: "Error fetching company" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = updateCompanySchema.parse({ ...body, id });

    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (existingCompany.length === 0) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    if (validatedData.legalName && validatedData.legalName !== existingCompany[0].legalName) {
      const duplicateLegalName = await db
        .select()
        .from(companies)
        .where(and(
          eq(companies.legalName, validatedData.legalName),
          eq(companies.active, true)
        ))
        .limit(1);

      if (duplicateLegalName.length > 0) {
        return NextResponse.json(
          { error: "Ya existe una empresa activa con este nombre legal" },
          { status: 400 }
        );
      }
    }

    if (validatedData.email && validatedData.email !== existingCompany[0].email) {
      const duplicateEmail = await db
        .select()
        .from(companies)
        .where(and(
          eq(companies.email, validatedData.email),
          eq(companies.active, true)
        ))
        .limit(1);

      if (duplicateEmail.length > 0) {
        return NextResponse.json(
          { error: "El correo electrónico ya está en uso por otra empresa activa" },
          { status: 400 }
        );
      }
    }

    const { id: _, ...updateData } = validatedData;

    const [updatedCompany] = await db
      .update(companies)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id))
      .returning();

    return NextResponse.json(updatedCompany);
  } catch (error) {
    console.error("Error updating company:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error updating company" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);

    if (existingCompany.length === 0) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    await db
      .update(companies)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting company:", error);
    return NextResponse.json(
      { error: "Error deleting company" },
      { status: 500 }
    );
  }
}
