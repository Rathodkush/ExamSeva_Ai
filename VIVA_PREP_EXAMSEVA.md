# 🎓 ExamSeva: Project Viva Preparation Guide

Sare important questions aur unke formal answers jo aap examiner ke samne bol sakte hain.

---

### 1. Why you have selected this topic?
Maine ye topic isliye select kiya kyunki students ko aksar purane question papers aur quality study materials dhoondhne mein bahut mehnat karni padti hai. Is project ka goal tha ek aisa platform banana jo **AI technology** ka use karke students ko automatic quiz aur specialized notes provide kare, jisse unki exam preparation easy aur organized ho jaye.

---

### 2. Why you kept this project name?
Project ka naam **'ExamSeva'** do words se milkar bana hai: **'Exam'** (Pariksha) aur **'Seva'** (Service). Iska matlab hai 'Exams ke liye help provide karne wali service'. Ye name platform ke core purpose 'Student Service' ko reflect karta hai.

---

### 3. Problem definition of project?
Aaj ke time par study materials scattered (bikhre hue) hain. Students ko ye nahi pata hota ki kon se questions important hain. Manual paper analysis bahut time leta hai. Humein ek aise system ki zaroorat thi jo **PDF parsing aur AI extraction** ke zariye automation la sake aur ek collaborative discussion forum provide kar sake.

---

### 4. Scope of project?
ExamSeva ka scope students ko digital learning resources provide karna hai. Isme notes sharing, AI-driven question extraction, interactive quizzes, aur peer-to-peer discussion system (Forum) shamil hai. Iska future scope automated grading aur personalized performance analysis tak extend kiya ja sakta hai.

---

### 5. Modules in project?
Project mein 6 main modules hain:
1.  **Authentication Module** (Login/Signup/OTP)
2.  **User Profile Module** (Profile management)
3.  **Study Hub Module** (File upload aur notes access)
4.  **Quiz & AI Engine Module** (Question extraction aur assessment)
5.  **Forum Module** (Discussion aur community interaction)
6.  **Admin Dashboard** (User aur Content management)

---

### 6. Functionality of each modules?
*   **Auth:** Secure access using JWT tokens aur OTP verification.
*   **Study Hub:** Students papers upload kar sakte hain aur category-wise notes access kar sakte hain.
*   **Quiz:** AI automatic PDF se questions nikalta hai aur user ke liye dynamic quiz banata hai.
*   **Forum:** Users posts create kar sakte hain aur dusron ke sawalon ka jawab de sakte hain (Real-time).
*   **Admin Dashboard:** Admin total users, papers count aur system health monitor karta hai.

---

### 7. Technology used and why this selection?
*   **Frontend (React.js):** Fast loading (Single Page Application) aur reusable components ke liye.
*   **Backend (Node.js & Express):** Scalable APIs banane ke liye.
*   **Database (MongoDB):** Flexible schema (NoSQL) ke liye, jo complex quiz structures ko store kar sake.
*   **AI Service (Python/Flask):** Natural Language Processing aur PDF processing (AI extraction) ke liye best libraries available hain.

---

### 8. All design diagram notations?
Humein standard **UML (Unified Modeling Language)** notations use kiye hain:
*   **Use Case Diagram:** Actors (User/Admin) aur unke interactions dikhane ke liye.
*   **ER Diagram (Entity Relationship):** Database tables aur unke relation ke liye.
*   **DFD (Data Flow Diagram):** Data ka flow level-0 (system overview) se level-1 (module flow) tak.

---

### 9. Flow of software (Very Important)?
1.  User register karta hai (OTP verify karke).
2.  Login ke baad User **Study Hub** mein jata hai.
3.  User ya toh naya paper upload karta hai ya purane papers dekhta hai.
4.  Humara **Python-based AI** paper se questions extract karta hai.
5.  User un questions ka **Quiz** deta hai aur score generate hota hai.
6.  Agar koi doubt ho toh **Forum** mein query post karta hai.

---

### 10. Types of testing done on project?
1.  **Unit Testing:** Individual UI components aur logic functions ko test kiya gaya.
2.  **Integration Testing:** Frontend APIs aur Backend database connections ko saath mein test kiya gaya.
3.  **System/E2E Testing:** Pura user flow check kiya gaya (Registration se Quiz result tak).

---

### 11. Model used?
Maine **Agile/Iterative Model** use kiya hai. Isme humne project ko chhote sprints (parts) mein divide kiya, har module banne ke baad uski feedback check ki aur improve kiya.

---

### 12. Demonstration with Validation:
Demonstration dikhate waqt in validations par focus karein:
*   **Field Validation:** Khali form submit karne par error ana (Jaise Login/Register).
*   **Role Validation:** Bina login ke user dashboard access nahi kar sakta; Student admin panel access nahi kar sakta.
*   **Real-time Validation:** Jaise hi Forum par reply aaye, notifications ka turant aana.

---

### 13. Path of database should be known properly:
*   **Path:** `mongodb://127.0.0.1:27017/examsevaDB` (Local installation).
*   **Collections:** `Users`, `Posts`, `Quizzes`, `Messages`, `Notifications`. Yeh `/backend/server.js` mein aur `models/` folder mein define toh hain, par access karne ke liye `mongoose.connect()` function ka use hota hai.

---
**All the Best for your Viva!** 🚀
