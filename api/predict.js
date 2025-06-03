export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Hanya izinkan POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { data } = body;

    // Validasi input
    if (!data || !Array.isArray(data) || data.length !== 4) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          message:
            'Expected "data" field with array of 4 numbers [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin]',
          example: { data: [24, 10.5, 85.2, 1] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const [umur_bulan, berat_badan, tinggi_badan, jenis_kelamin] =
      data.map(Number);

    // Validasi angka
    if (isNaN(umur_bulan) || umur_bulan < 0 || umur_bulan > 60) {
      return new Response(
        JSON.stringify({
          error: "Invalid age",
          message: "Umur harus antara 0-60 bulan",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (isNaN(berat_badan) || berat_badan < 1 || berat_badan > 50) {
      return new Response(
        JSON.stringify({
          error: "Invalid weight",
          message: "Berat badan harus antara 1-50 kg",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (isNaN(tinggi_badan) || tinggi_badan < 40 || tinggi_badan > 150) {
      return new Response(
        JSON.stringify({
          error: "Invalid height",
          message: "Tinggi badan harus antara 40-150 cm",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (![0, 1].includes(jenis_kelamin)) {
      return new Response(
        JSON.stringify({
          error: "Invalid gender",
          message: "Jenis kelamin harus 0 (perempuan) atau 1 (laki-laki)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Lakukan prediksi
    const prediction = calculateStuntingStatus(
      umur_bulan,
      berat_badan,
      tinggi_badan,
      jenis_kelamin
    );

    return new Response(
      JSON.stringify({
        success: true,
        prediction: prediction.status,
        confidence: prediction.confidence,
        probabilities: prediction.probabilities,
        input: {
          umur_bulan: umur_bulan,
          berat_badan: berat_badan,
          tinggi_badan: tinggi_badan,
          jenis_kelamin: jenis_kelamin === 1 ? "Laki-laki" : "Perempuan",
        },
        z_score: prediction.z_score,
        interpretation: prediction.interpretation,
        recommendation: prediction.recommendation,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Prediction error:", error);
    return new Response(
      JSON.stringify({
        error: "Server error",
        message: "Terjadi kesalahan dalam memproses data",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

// Fungsi untuk menghitung status stunting berdasarkan WHO Growth Standards
function calculateStuntingStatus(
  umur_bulan,
  berat_badan,
  tinggi_badan,
  jenis_kelamin
) {
  // Standar tinggi badan menurut umur (Height-for-Age) WHO
  // Ini adalah approximation sederhana - dalam produksi gunakan tabel WHO lengkap

  let expectedHeight, heightSD;

  if (jenis_kelamin === 1) {
    // Laki-laki
    if (umur_bulan <= 24) {
      expectedHeight = 49.9 + umur_bulan * 1.1; // Approximation untuk 0-24 bulan
      heightSD = 2.5;
    } else {
      expectedHeight = 75 + (umur_bulan - 24) * 0.6; // Approximation untuk >24 bulan
      heightSD = 3.0;
    }
  } else {
    // Perempuan
    if (umur_bulan <= 24) {
      expectedHeight = 49.1 + umur_bulan * 1.05; // Approximation untuk 0-24 bulan
      heightSD = 2.4;
    } else {
      expectedHeight = 74 + (umur_bulan - 24) * 0.55; // Approximation untuk >24 bulan
      heightSD = 2.9;
    }
  }

  // Hitung Z-score untuk Height-for-Age
  const z_score = (tinggi_badan - expectedHeight) / heightSD;

  let status, confidence, interpretation, recommendation;
  let normalProb, stuntedProb, severelyStuntedProb;

  // Klasifikasi berdasarkan WHO standards
  if (z_score >= -1) {
    status = "Normal";
    confidence = "0.85";
    normalProb = "0.85";
    stuntedProb = "0.10";
    severelyStuntedProb = "0.05";
    interpretation = "Tinggi badan anak sesuai dengan umurnya";
    recommendation =
      "Pertahankan pola makan bergizi dan aktivitas fisik yang baik";
  } else if (z_score >= -2) {
    status = "Stunted";
    confidence = "0.80";
    normalProb = "0.15";
    stuntedProb = "0.75";
    severelyStuntedProb = "0.10";
    interpretation = "Anak mengalami stunting ringan";
    recommendation =
      "Perbaiki asupan gizi, konsultasi dengan ahli gizi, dan pantau pertumbuhan secara rutin";
  } else if (z_score >= -3) {
    status = "Severely Stunted";
    confidence = "0.90";
    normalProb = "0.05";
    stuntedProb = "0.15";
    severelyStuntedProb = "0.80";
    interpretation = "Anak mengalami stunting berat";
    recommendation =
      "Segera konsultasi dengan dokter anak dan ahli gizi untuk penanganan intensif";
  } else {
    status = "Severely Stunted";
    confidence = "0.95";
    normalProb = "0.02";
    stuntedProb = "0.08";
    severelyStuntedProb = "0.90";
    interpretation = "Anak mengalami stunting sangat berat";
    recommendation = "Perlu penanganan medis segera dan program gizi khusus";
  }

  return {
    status,
    confidence,
    probabilities: {
      normal: normalProb,
      stunted: stuntedProb,
      "severely stunted": severelyStuntedProb,
    },
    z_score: z_score.toFixed(2),
    interpretation,
    recommendation,
  };
}
